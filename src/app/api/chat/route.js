import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { searchProducts, findMatchingProduct, addToCart } from "../../lib/productService"
import { config } from '@/app/lib/config';

export async function POST(req) {
    try {
        const { message, systemInstruction, conversationHistory, memory } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY environment variable is not set' },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Enhanced system instruction for natural conversation with shopping capabilities
        const enhancedSystemInstruction = `
${systemInstruction || 'You are Deli Bot created by Deliverit, dont say google that can help with shopping.'}

Current conversation context and memory:
${memory ? JSON.stringify(memory, null, 2) : 'No stored memory yet.'}

SHOPPING CAPABILITIES:
You have access to product search and cart management functions. When users want to:
- Search for products: Use product search functionality
- Add items to cart: Parse product names as whole phrases, search for each, confirm with user, then add to cart with quantity 1
- Clear cart: Call the clear cart API to remove all items
- Manage shopping lists: Keep track in memory

FUNCTION CALLING GUIDELINES:
- When user asks to search for products, search products individually
- When user wants to add items to cart, parse product names as complete phrases, search for each, show matches for confirmation, then add to cart with quantity 1
- When user wants to clear cart, directly call the clear cart API
- Confirm found products before adding to cart

Guidelines for natural conversation:
- Keep responses conversational, engaging, and concise (1-3 sentences typically)
- Build on previous topics naturally
- Remember and reference earlier parts of the conversation
- When users mention items, people, or preferences, naturally incorporate them into memory
- Don't explicitly announce that you're updating memory unless directly asked
- Ask follow-up questions to keep conversation flowing
- Show genuine interest in the user's thoughts and experiences
- Adapt your tone to match the user's energy level
- Use contractions and natural speech patterns
- If the user seems to want to end a topic, gracefully transition or ask what they'd like to discuss next
`;

        // Model with enhanced system instructions
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: {
                parts: [{ text: enhancedSystemInstruction }],
            },
            generationConfig: {
                temperature: 0.8,
                topP: 0.9,
                topK: 40,
                maxOutputTokens: 300,
            },
        });

        // Build conversation history
        const history = (conversationHistory || [])
            .filter((msg) => ['user', 'assistant', 'model'].includes(msg.role))
            .slice(-20)
            .map((msg) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            }))
            .filter((msg) => msg.role !== 'system');

        const chat = model.startChat({
            history,
            safetySettings: [
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
                },
            ],
        });

        // Get the latest user message
        const latestMessage = message || conversationHistory[conversationHistory.length - 1]?.content;

        if (!latestMessage) {
            return NextResponse.json(
                { error: 'No message provided' },
                { status: 400 }
            );
        }

        // Check if user wants to search for products, add to cart, or clear cart
        let productSearchResults = null;
        let cartResults = [];
        let responsePrefix = '';

        // Product search patterns
        const searchPatterns = [
            /search for (.+)/i,
            /find (.+) products?/i,
            /looking for (.+)/i,
            /show me (.+)/i,
            /what (.+) do you have/i,
        ];

        // Add to cart patterns
        const addToCartPatterns = [
            /add (.+) to cart/i,
            /add (.+) to card/i,
            /add (.+) to cut/i,
             /add (.+) too cut/i,
            /add (.+) too card/i,
            /add (.+) two cut/i,
            /add (.+) two card/i,
            /buy (.+)/i,
            /purchase (.+)/i,
            /order (.+)/i,
            /get (.+) for me/i,
        ];

        // Clear cart patterns
        const clearCartPatterns = [
            /remove cart/i,
            /empty cart/i,
            /delete cart/i,
            /clear my cart/i,
            /empty my cart/i,
            /delete my cart/i,
            /clear my cart/i,
            /clear cut/i,
            /clear card/i,

            /clear cart/i,
        ];

        // Parse product names (ignoring quantities, preserving whole phrases)
        const parseProductNames = (query) => {
            const products = query
                .split(/,|\sand\s/i)
                .map(item => item.trim())
                .filter(item => item.length > 0 && !item.match(/^(to|the|a|an|some|any)$/i));
            return products;
        };

        // Check for clear cart intent
        let clearCartTriggered = false;
        for (const pattern of clearCartPatterns) {
            if (latestMessage.match(pattern)) {
                clearCartTriggered = true;
                try {
                    const clearCartResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/clearCart`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'ware_house_id': '1',
                            'outletId': '11512',
                            'token':config.customerToken
                        },
                        body: JSON.stringify({
                            deviceId: '1ac9e66c065553ff8b7aa07f9bbef4e9',
                            is_pan_corner: 0,
                            lat: '28.6016406',
                            long: '77.3896809',
                            order_delivery_type: 1,
                        }),
                    });

                    if (clearCartResponse.ok) {
                        responsePrefix = 'Your cart has been successfully cleared! ';
                        // Clear the shopping list in memory
                        if (memory?.lists?.shopping) {
                            memory.lists.shopping = [];
                        }
                    } else {
                        responsePrefix = 'Sorry, I couldn’t clear your cart. Please try again. ';
                    }
                } catch (error) {
                    console.error('Clear cart error:', error);
                    responsePrefix = 'I had trouble clearing your cart. Please try again. ';
                }
                break;
            }
        }

        // Only proceed with search or add-to-cart if clear cart wasn't triggered
        if (!clearCartTriggered) {
            // Check for product search intent
            // Check for product search intent
            for (const pattern of searchPatterns) {
                const match = latestMessage.match(pattern);
                if (match) {
                    try {
                        const searchQuery = match[1].trim();
                        productSearchResults = await searchProducts(searchQuery);

                        if (productSearchResults && productSearchResults.data && productSearchResults.data.length > 0) {

                            // Format product list with name, image, and price
                            const productList = productSearchResults.data.slice(0, 5).map(p => {

                                const name = p.name || p.title || 'Unknown Product';
                                const price = p.price ? `$${p.price.toFixed(2)}` : 'Price not available';
                                const image = p.image || 'No image available';
                                return `${name} (ID: ${p.id}, Price: ${price}, Image: ${image})`;
                            }).join(', ');

                            // Prepare enriched product data for the response
                            const enrichedProductResults = productSearchResults.data.slice(0, 5).map(p => ({
                                id: p.id,
                                name: p.name || p.title || 'Unknown Product',
                                price: p.product_images[0].base_price || null,
                                image: p.product_images[0].path || null,
                            }));

                            responsePrefix = `I found these products: ${productList}.`;
                            // Update productSearchResults to include enriched data
                            productSearchResults = enrichedProductResults;
                        } else {
                            responsePrefix = `I couldn't find any products matching "${searchQuery}". `;
                            productSearchResults = [];
                        }
                    } catch (error) {
                        console.error('Product search error:', error);
                        responsePrefix = `I had trouble searching for products. `;
                        productSearchResults = [];
                    }
                    break;
                }
            }

            for (const pattern of addToCartPatterns) {
                const match = latestMessage.match(pattern);
                if (match) {
                    const productQuery = match[1].trim();
                    const customerToken = memory?.customerToken;

                    try {
                        const productNames = parseProductNames(productQuery);

                        if (productNames.length === 0) {
                            responsePrefix = `I couldn't parse any products from "${productQuery}". Please list items like "Item" or "Item1, Item2". `;
                            break;
                        }

                        const foundProducts = [];
                        const notFoundProducts = [];

                        for (const name of productNames) {
                            const searchResults = await searchProducts(name);

                            if (searchResults && searchResults.data && searchResults.data.length > 0) {
                                // ✅ collect ALL matches for UI
                                const matched = searchResults.data.slice(0, 5).map(p => ({
                                    id: p.id,
                                    name: p.name,
                                    image: p.product_images?.[0]?.path || null,
                                    price: p.base_price || null,
                                }));

                                foundProducts.push(...matched);


                                // ✅ only add the first product to cart
                                const firstMatch = findMatchingProduct(searchResults.data, name);
                                try {
                                    const cartResult = await addToCart(
                                        firstMatch.id,
                                        1,
                                        customerToken,
                                        memory?.location?.lat || "28.6016406",
                                        memory?.location?.long || "77.3896809"
                                    );
                                    cartResults.push({
                                        name: firstMatch.name,
                                        result: cartResult
                                    });
                                } catch (error) {
                                    console.error(`Error adding ${firstMatch.name} to cart:`, error);
                                    responsePrefix += `Sorry for the inconvenience, ${firstMatch.name} is not available. \n`;
                                }
                            } else {
                                notFoundProducts.push(name);
                            }
                        }

                        // ✅ show ALL found matches in response
                        if (foundProducts.length > 0) {
                            const productList = foundProducts
                                .map(p => `${p.name} (ID: ${p.id})(Image: ${p.image})(Price: ${p.price})`)
                                .join(', ');

                            responsePrefix += `I found these products: ${productList}. `;
                        }
                        if (notFoundProducts.length > 0) {
                            responsePrefix += `Couldn't find: ${notFoundProducts.join(', ')}. `;
                        }

                        if (cartResults.length > 0) {
                            responsePrefix += `\n Successfully added: ${cartResults.map(p => p.name).join(', ')}. `;
                        }
                    } catch (error) {
                        console.error('Add to cart error:', error);
                        responsePrefix = `I had trouble adding items to your cart. `;
                    }
                    break;
                }
            }

        }

        // Send message and get response
        const result = await chat.sendMessage(latestMessage);
        const response = result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
            'I apologize, but I couldn\'t generate a response right now.';

        // Enhanced memory management
        let updatedMemory = { ...memory } || {
            lists: {},
            context: {},
            preferences: {},
            topics: [],
            people: [],
            locations: [],
            customerToken: null,
        };

        // Extract memory from message and response
        const extractMemoryFromMessage = (msg, response) => {
            const lowerMsg = msg.toLowerCase();

            // Extract customer token if provided
            const tokenMatch = msg.match(/(?:token|customer token):\s*([a-zA-Z0-9._-]+)/i);
            if (tokenMatch) {
                updatedMemory.customerToken = tokenMatch[1];
            }

            // Extract location if provided
            const latMatch = msg.match(/(?:lat|latitude):\s*([\d.-]+)/i);
            const longMatch = msg.match(/(?:long|longitude):\s*([\d.-]+)/i);
            if (latMatch && longMatch) {
                if (!updatedMemory.location) updatedMemory.location = {};
                updatedMemory.location.lat = latMatch[1];
                updatedMemory.location.long = longMatch[1];
            }

            // Extract shopping/todo items
            const addPatterns = [
                /(?:add|put|include|need|want|buy|get|pick up|remember to)\s+([^.!?]*)/gi,
                /(?:i need|i want|i should get|let me add|don't forget)\s+([^.!?]*)/gi,
            ];

            const removePatterns = [
                /(?:remove|delete|got|bought|finished|done with|no longer need)\s+([^.!?]*)/gi,
                /(?:i got|i bought|i have|i don’t need)\s+([^.!?]*)/gi,
            ];

            // Process additions
            addPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(lowerMsg)) !== null) {
                    const items = match[1]
                        .split(/,|\sand\s/i)
                        .map(item => item.trim())
                        .filter(item => item.length > 2 && !item.match(/^(to|the|a|an|some|any)$/i));

                    if (!updatedMemory.lists.shopping) {
                        updatedMemory.lists.shopping = [];
                    }

                    items.forEach(item => {
                        if (!updatedMemory.lists.shopping.includes(item)) {
                            updatedMemory.lists.shopping.push(item);
                        }
                    });
                }
            });

            // Extract preferences
            const preferencePatterns = [
                /i (?:like|love|enjoy|prefer|hate|dislike)\s+([^.!?]*)/gi,
                /my favorite\s+([^.!?]*)/gi,
            ];

            preferencePatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(lowerMsg)) !== null) {
                    const preference = match[1].trim();
                    if (preference.length > 2) {
                        if (!updatedMemory.preferences.interests) {
                            updatedMemory.preferences.interests = [];
                        }
                        if (!updatedMemory.preferences.interests.includes(preference)) {
                            updatedMemory.preferences.interests.push(preference);
                        }
                    }
                }
            });

            return updatedMemory;
        };

        // Apply memory extraction
        updatedMemory = extractMemoryFromMessage(latestMessage, response);

        // Enhanced response formatting
        let finalResponse = responsePrefix + response;

        // Add shopping list context
        if (/(?:show|tell me|what's on|what do i have)\s*(?:my|the)?\s*(?:list|shopping|todo)/i.test(latestMessage)) {
            const shoppingList = updatedMemory.lists?.shopping || [];
            if (shoppingList.length > 0) {
                finalResponse = `Here's what you have on your list: ${shoppingList.join(', ')}. ${response}`;
            } else {
                finalResponse = `Your list is empty right now. ${response}`;
            }
        }

        // Clean up response for voice synthesis
        finalResponse = finalResponse
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/#{1,6}\s/g, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return NextResponse.json({
            response: finalResponse,
            text: finalResponse,
            success: true,
            memoryUpdate: updatedMemory,
            productSearchResults,
            cartResult: cartResults,
            conversationFlow: {
                shouldContinueListening: true,
                suggestedFollowUp: cartResults.length > 0 ? 'Anything else you want to add to your cart?' :
                    clearCartTriggered ? 'Your cart is cleared! Want to add something new?' : null,
            }
        });

    } catch (error) {
        console.error('Enhanced Gemini API Error:', error);

        let errorMessage = 'I apologize, but I\'m having trouble connecting right now.';

        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                errorMessage = 'There seems to be an authentication issue. Please check the API configuration.';
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                errorMessage = 'I\'ve reached my usage limit for now. Please try again in a moment.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'I\'m having network connectivity issues. Please try again.';
            }
        }

        return NextResponse.json(
            {
                error: 'Failed to generate response',
                response: errorMessage,
                text: errorMessage,
                success: false,
            },
            { status: 500 }
        );
    }
}
