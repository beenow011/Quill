import { db } from "@/db";
import { openai } from "@/lib/openai";
import { getPineconeClient } from "@/lib/pinecone";
import { SendMessageValidator } from "@/lib/validators/SendMessageValidator";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { NextRequest } from "next/server";
import { OpenAIStream, StreamingTextResponse } from 'ai'

interface SearchResult {
    pageContent: string;
    metadata: {
        fileName: string;
    };
}

function customFilter(result: SearchResult, targetFileName: string): boolean {
    return result.metadata?.fileName === targetFileName;
}

export const POST = async (req: NextRequest) => {
    const body = await req.json()

    const { getUser } = getKindeServerSession();
    const user = await getUser()
    // const { id: userId } = user?


    if (!user || !user.id) {
        return new Response('Unauthorized', { status: 401 })
    }

    const { fileId, message } = SendMessageValidator.parse(body)
    console.log("2", message)

    const file = await db.file.findFirst({
        where: {
            id: fileId,
            userId: user.id
        }
    })
    if (!file) {
        return new Response('Not found', { status: 404 })
    }

    await db.message.create({
        data: {
            text: message,
            isUserMessage: true,
            userId: user.id,
            fileId
        }
    })

    const pinecone = await getPineconeClient()
    // console.log(2)

    const pineconeIndex = pinecone.Index("quill")
    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY
    })

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, { pineconeIndex })


    const results = await vectorStore.similaritySearch(message, 1, {
        filter: (result: SearchResult) => customFilter(result, file.id)
    });

    const prevMessage = await db.message.findMany({
        where: {
            fileId
        },
        orderBy: {
            createdAt: "asc"
        },
        take: 6
    })

    const formattedMessages = prevMessage.map(msg => ({
        role: msg.isUserMessage ? "user" as const : "assistant" as const,
        content: msg.text
    }))

    const context = `PREVIOUS CONVERSATION:${formattedMessages.map((msg) => {
        if (msg.role === 'user') return `User:${msg.content}\n`;
        return `Assistant:${msg.content}\n`;
    })}CONTEXT:${results.map((r) => r.pageContent).join('\n\n')}USER INPUT:${message}`;

    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        temperature: 0,
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
    })

    const stream = OpenAIStream(response, {
        async onCompletion(completion) {
            await db.message.create({
                data: {
                    text: completion,
                    isUserMessage: false,
                    fileId,
                    userId: user.id
                }
            })
        }
    })
    return new StreamingTextResponse(stream);
}