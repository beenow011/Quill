import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
// import { UploadThingError } from "uploadthing/server";
import {PDFLoader} from 'langchain/document_loaders/fs/pdf'
import { getPineconeClient } from '@/lib/pinecone'
import {OpenAIEmbeddings} from '@langchain/openai'
import {PineconeStore} from '@langchain/pinecone'
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { getUserSubscriptionPlan } from "@/lib/stripe";
import { Plans } from "@/config/stripe";

const f = createUploadthing();
 
const middleware = async()=>{
  const {getUser} = getKindeServerSession();
  const user =  await getUser()
  if(!user || !user.id){
    throw new Error('Unauthorized')
  }

  const subscriptionPlan = await getUserSubscriptionPlan()
  return {subscriptionPlan ,userId:user.id };
}

const onUploadComplete = async({ metadata, file }:{metadata:Awaited<ReturnType<typeof middleware>> , file:{
  key: string
  name: string
url:string
}})=> {
  const isFileExist = await db.file.findFirst({
    where:{
      key: file.key
    }
  })
  if(isFileExist)
    return 
  
  const createdFile = await db.file.create({
    data:{
      key: file.key,
      name:file.name,
      userId: metadata.userId,
      url: file.url,
      uploadStatus:'PROCESSING'
    }
  })
  try{
    const response = await fetch(file.url)
    const blob = await response.blob()

    const loader = new PDFLoader(blob)

    const pageLevelDocs = await loader.load()
    const pagesAmt = pageLevelDocs.length
    const {subscriptionPlan} = metadata
    const {isSubscribed} = subscriptionPlan

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
  }
}


export const ourFileRouter = {
 
  freePlanUploader: f({ pdf: { maxFileSize: "4MB" } })
   
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),

    proPlanUploader: f({ pdf: { maxFileSize: "16MB" } })
   
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),

   
} satisfies FileRouter;
 
//type 
export type OurFileRouter = typeof ourFileRouter;