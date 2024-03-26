import {Pinecone} from '@pinecone-database/pinecone'

export const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
})

//  pinecone.createIndex({
//     name: 'quickstart',
//     dimension: 8,
//     metric: 'euclidean',
//     spec: { 
//       serverless: { 
//         cloud: 'aws', 
//         region: 'us-west-2' 
//       }
//     } 
//   }); 