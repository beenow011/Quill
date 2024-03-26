// import {Pinecone} from '@pinecone-database/pinecone'

// export const pinecone = new Pinecone({
//     apiKey: process.env.PINECONE_API_KEY!,
// })

// //  pinecone.createIndex({
// //     name: 'quickstart',
// //     dimension: 8,
// //     metric: 'euclidean',
// //     spec: { 
// //       serverless: { 
// //         cloud: 'aws', 
// //         region: 'us-west-2' 
// //       }
// //     } 
// //   }); 

import { Pinecone } from '@pinecone-database/pinecone';

export const getPineconeClient = async () => {
  const client = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
  });
  console.log(0)

  return client;
}