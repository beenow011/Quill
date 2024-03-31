import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import {PDFLoader} from 'langchain/document_loaders/fs/pdf'
import { getPineconeClient } from '@/lib/pinecone'
import {OpenAIEmbeddings} from '@langchain/openai'
import {PineconeStore} from '@langchain/pinecone'
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

const f = createUploadthing();
 

export const ourFileRouter = {
 
  pdfUploader: f({ pdf: { maxFileSize: "4MB" } })
   
    .middleware(async ({ req }) => {
      const {getUser} = getKindeServerSession();
      const user =  await getUser()
      if(!user || !user.id){
        throw new Error('Unauthorized')
      }
      return {userId:user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log(file.url)
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
    }),

   
} satisfies FileRouter;
 
export type OurFileRouterType = typeof ourFileRouter;