import { db } from '@/db';
import { openai } from '@/lib/openai';
import { getPineconeClient } from '@/lib/pinecone';
// import { SendMessageValidator } from '@/lib/SendMessageValidator';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { NextRequest } from 'next/server';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { SendMessageValidator } from '@/lib/validators/SendMessageValidator';

interface SearchResult {
    pageContent: string;
    metadata: {
        fileId: string;
    };
}

function customFilter(result: SearchResult, targetFileName: string): boolean {
    console.log("result", result)
    return result.metadata?.fileId === targetFileName;
}

export const POST = async (req: NextRequest) => {
    const body = await req.json();
    const { getUser } = getKindeServerSession();
    const user = await getUser()
    // const { id: userId } = user?


    if (!user || !user.id) {
        return new Response('Unauthorized', { status: 401 })
    }

    const { fileId, message } = SendMessageValidator.parse(body);
    // console.log("file", fileId)
    // console.log("message", message)
    const file = await db.file.findFirst({ where: { id: fileId, userId: user.id } });
    console.log(file?.name)
    if (!file) {
        return new Response('Not found', { status: 404 });
    }

    await db.message.create({
        data: {
            text: message,
            isUserMessage: true,
            userId: user.id,
            fileId,
        },
    })

    // 1: Vectorize message
    const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });

    // Initialize the Pinecone vector store
    const pinecone = await getPineconeClient();
    const pineconeIndex = pinecone.Index('quill'); // Use a single index name

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, { pineconeIndex });


    try {
        // Search for similar messages using the file ID as context
        const results = await vectorStore.similaritySearch(message, 4, { fileId });
        // console.log("res", results)

        // const filteredResult = results.filter(ele => ele.metadata.fileId === fileId)
        // console.log("filter", filteredResult)
        const prevMessages = await db.message.findMany({
            where: { fileId },
            orderBy: { createdAt: 'asc' },
            take: 6,
        });
        const formattedPrevMessages = prevMessages.map((msg) => ({
            role: msg.isUserMessage ? 'user' : 'assistant',
            content: msg.text,
        }));

        // Construct a context string with previous conversation, results, and user input
        const context = `PREVIOUS CONVERSATION:${formattedPrevMessages.map((msg) => {
            if (msg.role === 'user') return `User:${msg.content}\n`;
            return `Assistant:${msg.content}\n`;
        })}CONTEXT:${results.map((r) => r.pageContent).join('\n\n')}USER INPUT:${message}`;


        // Use a system message to instruct the model
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            temperature: 0.7, // Adjust the temperature as needed
            stream: true,
            messages: [
                {
                    role: 'system',
                    content: 'You have access to a PDF document. Please use the information from the document to answer the user\'s question.',
                },
                {
                    role: 'user',
                    content: context, // Provide the context here
                },
            ],
        });

        const stream = OpenAIStream(response, {
            async onCompletion(completion) {
                await db.message.create({
                    data: {
                        text: completion,
                        isUserMessage: false,
                        fileId,
                        userId: user.id,
                    },
                });
            },
        });
        // console.log(stream)

        return new StreamingTextResponse(stream);
    } catch (error) {
        console.error('Error searching for similar messages:', error);
        return new Response('InternalServerError', { status: 500 });
    }
};