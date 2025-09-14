import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Updated to a more recent model

  // Enhanced prompt with stricter instructions
  const enhancedPrompt = `
    ${prompt}

    Additional Instructions:
    - Ensure the response is strictly valid JSON, enclosed in \`\`\`json\`\`\` markdown.
    - For each product mentioned in the input, include a product object in the 'products' array with exactly these fields: {name: string, price: number, description: string, image: string}.
    - If price, description, or image are not provided in the input, use reasonable defaults (e.g., price: 0, description: "No description available", image: "No image available").
    - Remove any non-product-related details like IDs or tool code from the 'text' field.
    - Ensure num_products matches the number of products listed in the 'products' array.
    - Do not include any text outside the JSON object.
  `;

  try {
    console.log("Enhanced Prompt:", enhancedPrompt);
    const result = await model.generateContent(enhancedPrompt);
    let data = result.response.text();
    

    // Extract JSON from markdown code fences or raw JSON
    let parsedData;
    const jsonMatch = data.match(/```json\s*([\s\S]*?)\s*```/) || data.match(/{[\s\S]*}/);
    if (jsonMatch && jsonMatch[1]) {
      parsedData = JSON.parse(jsonMatch[1].trim());
    } else {
      try {
        parsedData = JSON.parse(data);
      } catch {
        throw new Error("Invalid JSON format");
      }
    }

    // Validate the parsed data structure
    if (!parsedData.text || typeof parsedData.num_products !== 'number' || !Array.isArray(parsedData.products)) {
      throw new Error("Invalid JSON structure");
    }

    return NextResponse.json(parsedData);
  } catch (error) {
    console.error("Error generating or parsing response:", error);
    // Fallback response with the original raw text
    const rawTextMatch = prompt.match(/Response to parse: "([^"]*)"/);
    const rawText = rawTextMatch ? rawTextMatch[1] : "Failed to parse response";
    return NextResponse.json({
      text: rawText.replace(/\(ID:.*?\)/g, "").replace(/`tool_code.*?\`/g, "").trim(),
      num_products: 0,
      products: []
    }, { status: 500 });
  }
}