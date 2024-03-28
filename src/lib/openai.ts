// import { OpenAI } from "@langchain/openai";

import OpenAI from "openai";

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})