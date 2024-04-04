import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { privateProcedure, publicProcedure, router } from './trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';
 import {z} from 'zod'
import { INFINITE_QUERY_LIMIT } from '@/config/infinite-query';
import { absoluteUrl } from '@/lib/utils';
import { getUserSubscriptionPlan, stripe } from '@/lib/stripe';
import { Plans } from '@/config/stripe';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { getPineconeClient } from '@/lib/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
// import { CarTaxiFront } from 'lucide-react';
export const appRouter = router({
  authCallback : publicProcedure.query(async()=>{
    const {getUser} = getKindeServerSession()
    const user =await getUser()

    if(!user?.id || !user.email) throw new TRPCError({code:'UNAUTHORIZED'})

    const dbUser = await db.user.findFirst({
      where:{
        id: user.id
      }
    })

    if(!dbUser){
      await db.user.create({
        data:{
          id: user.id,
          email: user.email
        }
      })
    }
    return {success: true}
  }) ,
  uploadToEdgerStore: privateProcedure.input(z.object({url:z.string() , key: z.string() , name:z.string() , isSubscribed: z.boolean()})).mutation(async({ctx,input})=>{
    const {url,name,key  , isSubscribed} = input
    const {getUser} = getKindeServerSession()
    const user =await getUser()
    if(!user?.id || !user.email) throw new TRPCError({code:'UNAUTHORIZED'})

    const isFileExist = await db.file.findFirst({
      where:{
        key: key
      }
    })
    if(isFileExist)
      return false
    const userDb = await db.user.findFirst({
      where:{
        id:user.id
      }
    })
    // const {freeQuota} = userDb

    const createdFile = await db.file.create({
      data:{
        key: key,
        name: name,
        userId: user.id,
        url: url,
        uploadStatus:'PROCESSING'
      }
    })
    if(!isSubscribed && userDb!.freeQuota <=0){
      await db.file.update({
        data:{
          uploadStatus:"FAILED"
        },
        where:{
          id:createdFile.id
        }
      })
      return false
    }
    console.log(isSubscribed)
    console.log(userDb)

    if(!isSubscribed){
      await db.user.update({
        where:{
          id:user.id
        },
        data:{
          freeQuota: userDb!.freeQuota-1
        }
      })
    }
    try{
      const response = await fetch(url)
      const blob = await response.blob()
  
      const loader = new PDFLoader(blob)
  
      const pageLevelDocs = await loader.load()
      const pagesAmt = pageLevelDocs.length
      // const {subscriptionPlan} = metadata
      // const {isSubscribed} = subscriptionPlan
  
      const isProExceeded = pagesAmt > Plans.find(plan=> plan.name === 'Pro')!.pagesPerPdf
      const isFreeExceeded = pagesAmt > Plans.find(plan=> plan.name === 'Free')!.pagesPerPdf
      if((isSubscribed && isProExceeded) || (!isSubscribed && isFreeExceeded)){
        await db.file.update({
          data:{
            uploadStatus:"FAILED",
          },
          where:{
            id:createdFile.id
          }
        })
        return false
      }
      // console.log(1)
      const pinecone = await getPineconeClient();
      const pineconeIndex = pinecone.Index('quill'); // Use a single index name
  
      // Add a 'dataset' field to the data to distinguish the source
      const combinedData = pageLevelDocs.map((document) => {
        return {
          ...document,
          metadata: {
            fileId: createdFile.id,
          },
          dataset: 'pdf', // Use a field to indicate the source dataset (e.g., 'pdf')
        };
      });
      
      const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
  
      await PineconeStore.fromDocuments(combinedData, embeddings, {
        //@ts-ignore
        pineconeIndex,
      });
  
      await db.file.update({
        data:{
          uploadStatus:"SUCCESS"
        },
        where:{
          id:createdFile.id
        }
      })
      return true
    }catch(err){
      console.log(err)
      await db.file.update({
        data:{
          uploadStatus:"FAILED"
        },
        where:{
          id:createdFile.id
        }
      })
      return false
    }
  }),
  getUserFiles: privateProcedure.query(async({ctx})=>{
    const {userId } = ctx

    return await db.file.findMany({
      where:{
        userId
      }
    })

    // const id = user.id
  }),
  deleteFile: privateProcedure.input(z.object({id:z.string()})).mutation(async({ctx,input})=>{
    const {userId} = ctx
    const file = await db.file.findFirst({
      where:{
        id: input.id,
        userId
      }
    })
    if(!file){
      throw new TRPCError({code:'NOT_FOUND'})
    }
    await db.file.delete({
      where:{
        id: input.id
      }
  })
  return file
  }),
  getFile: privateProcedure.input(z.object({url: z.string()})).mutation(async({ctx,input})=>{
    const {userId} = ctx
    const file = await db.file.findFirst({
      where:{
        url:input.url,
        userId,
      }
    })
    if(!file) throw new TRPCError({code:'NOT_FOUND'})

    return file
  }),
  getFileUploadStatus: privateProcedure
  .input(z.object({ fileId: z.string() }))
  .query(async ({ input, ctx }) => {
    // console.log(ctx)
    // const {userId} =  ctx
    const file = await db.file.findFirst({
      where: {
        id: input.fileId,
        userId:ctx?.userId,
      },
    })

    if (!file) return { status: 'PENDING' as const }

    return { status: file.uploadStatus }
  }),
  getFileMessages: privateProcedure.input(z.object({
    limit: z.number().min(1).max(100).nullish(),
    cursor: z.string().nullish(),
    fileId: z.string()
  })).query(async({input,ctx})=>{
    const {userId} = ctx
    const {fileId,cursor}= input
    const limit = input.limit ?? INFINITE_QUERY_LIMIT

    const file = await db.file.findFirst({
      where:{
        id:fileId,
        userId
      }
    })
    if(!file){
      throw new TRPCError({code:"NOT_FOUND"})
    }
    const messages = await db.message.findMany({
      where:{
        fileId
      },
      take:limit+1,
      orderBy:{
        createdAt:"desc"
      },
      cursor:cursor ? {id:cursor}: undefined,
      select:{
        id:true,
        isUserMessage: true,
        createdAt: true,
        text:true
      }
    })
    let nextCursor : typeof cursor | undefined = undefined
    if(messages.length > limit){
      const nextitem = messages.pop()
      nextCursor = nextitem?.id
    }
    return {
      messages,
      nextCursor
    }
  }),
  createStripeSession: privateProcedure.mutation(
    async ({ ctx }) => {
      const { userId } = ctx

      const billingUrl = absoluteUrl('/dashboard/billing')
      // console.log(billingUrl)
      if (!userId)
        throw new TRPCError({ code: 'UNAUTHORIZED' })

      const dbUser = await db.user.findFirst({
        where: {
          id: userId,
        },
      })

      if (!dbUser)
        throw new TRPCError({ code: 'UNAUTHORIZED' })

      const subscriptionPlan =
        await getUserSubscriptionPlan()

      if (
        subscriptionPlan.isSubscribed &&
        dbUser.stripeCustomerId
      ) {
        try {
          const stripeSession =
          await stripe.billingPortal.sessions.create({
            customer: dbUser.stripeCustomerId,
            return_url: billingUrl,
          })
          if (stripeSession) {
            return { url: stripeSession.url }

            
          }
        } catch (error) {
          console.log(error)
          throw new TRPCError({ code: 'BAD_REQUEST' })

        }
      }

      const stripeSession =
        await stripe.checkout.sessions.create({
          success_url: billingUrl,
          cancel_url: billingUrl,
          payment_method_types: ['card'],
          mode: 'subscription',
          billing_address_collection: 'auto',
          line_items: [
            {
              price: Plans.find(
                (plan) => plan.name === 'Pro'
              )?.price.priceIds.test,
              quantity: 1,
            },
          ],
          metadata: {
            userId: userId,
          },
        })

      return { url: stripeSession.url }
    }
  ),
});
 
// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;