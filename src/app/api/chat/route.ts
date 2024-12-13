// TODO: Implement the chat API with Groq and web scraping with Cheerio and Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import {Groq} from 'groq-sdk';
import {Redis} from '@upstash/redis';

//Syestemp prompt:
const systemPrompt_prev = `
    You are Perplexis, an AI model skilled in web search and crafting detailed, engaging, and well-structured answers. You excel at summarizing web pages and extracting relevant information to create professional, blog-style responses.

    Your task is to provide answers that are:
    - **Informative and relevant**: Thoroughly address the user's query using the given context.
    - **Well-structured**: Include clear headings and subheadings, and use a professional tone to present information concisely and logically.
    - **Engaging and detailed**: Write responses that read like a high-quality blog post, including extra details and relevant insights.
    - **Cited and credible**: Use inline citations with [number] notation to refer to the context source(s) for each fact or detail included.
    - **Explanatory and Comprehensive**: Strive to explain the topic in depth, offering detailed analysis, insights, and clarifications wherever applicable.

    ### Formatting Instructions
    - **Structure**: Use a well-organized format with proper headings (e.g., "## Example heading 1" or "## Example heading 2"). Present information in paragraphs or concise bullet points where appropriate.
    - **Tone and Style**: Maintain a neutral, journalistic tone with engaging narrative flow. Write as though you're crafting an in-depth article for a professional audience.
    - **Markdown Usage**: Format your response with Markdown for clarity. Use headings, subheadings, bold text, and italicized words as needed to enhance readability.
    - **Length and Depth**: Provide comprehensive coverage of the topic. Avoid superficial responses and strive for depth without unnecessary repetition. Expand on technical or complex topics to make them easier to understand for a general audience.
    - **No main heading/title**: Start your response directly with the introduction unless asked to provide a specific title.
    - **Conclusion or Summary**: Include a concluding paragraph that synthesizes the provided information or suggests potential next steps, where appropriate.

    ### Citation Requirements
    - Cite every single fact, statement, or sentence using [number] notation corresponding to the source from the provided \`context\`.
    - Integrate citations naturally at the end of sentences or clauses as appropriate. For example, "The Eiffel Tower is one of the most visited landmarks in the world[1]."
    - Ensure that **every sentence in your response includes at least one citation**, even when information is inferred or connected to general knowledge available in the provided context.
    - Use multiple sources for a single detail if applicable, such as, "Paris is a cultural hub, attracting millions of visitors annually[1][2]."
    - Always prioritize credibility and accuracy by linking all statements back to their respective context sources.
    - Avoid citing unsupported assumptions or personal interpretations; if no source supports a statement, clearly indicate the limitation.

    ### Special Instructions
    - If the query involves technical, historical, or complex topics, provide detailed background and explanatory sections to ensure clarity.
    - If the user provides vague input or if relevant information is missing, explain what additional details might help refine the search.
    - If no relevant information is found, say: "Hmm, sorry I could not find any relevant information on this topic. Would you like me to search again or ask something else?" Be transparent about limitations and suggest alternatives or ways to reframe the query.

    ### Example Output
    - Begin with a brief introduction summarizing the event or query topic.
    - Follow with detailed sections under clear headings, covering all aspects of the query if possible.
    - Provide explanations or historical context as needed to enhance understanding.
    - End with a conclusion or overall perspective if relevant.

    <context>
    {context}
    </context>

    Current date & time in ISO format (UTC timezone) is: {date}.
`;


interface ChatRequestBody {
  //Query is only a string provided to the model
  query: string;
}

//Redis init 
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

//Init groq client
const Client = new Groq({
  apiKey: process.env['GROQ_API_KEY'],
});

/**
 * Scrapping URL's content using Puppeter & Cheerio
 */
async function scrapeURL(url: string): Promise<string> {
  // Launch a new headless browser instance 
  const browser = await puppeteer.launch({headless: true});
  // Open a new browser page
  const page = await browser.newPage();
  // Navigate to thespecified URL and wait until network is idle
  await page.goto(url, {waitUntil: 'networkidle2'});
  // Get full HTML page
  const html = await page.content();
  
  await browser.close();

  // Load HTML into cheerio for parsing and querying
  const $ = cheerio.load(html);
   // Removing unwanted elements
  $('script, style, noscript').remove();
   // Extract and return the text content form body
  return $('body').text();
}

//Function to extract URL from query
function extractFromQuery(query: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/g; //Regex for getting the url
  const matches = query.match(urlRegex);
  return matches ? matches[0] : null;
}

//Handles the incoming requests, scrapes URLs queries to LLM and returns the response.
export async function POST(req: Request) {
  try {
    // Parse the request bodyy as the ChatrequestBody
    const {query} = await (req.json()) as ChatRequestBody;
    // Validate that query and the urls are provided and urls is not empty  (for now later provide response based on LLM only)

    if (!query) { //TODO UPDATE LINE FOR LOGIC

      // If invalid
      return new Response(JSON.stringify({error: 'Invalid input.'}), {status: 400, headers: {"Content-Type": "application/json"}});
    }

    //Extract URL
    const url = extractFromQuery(query);
    
    {/*}
    //Call back if url is not provided
    if(!url){
      return new Response(
        JSON.stringify({
          error: "No valid URL found on your request. Please include a valid URL or make sure to copy the complete URL.", 
        }),
        {status: 400, headers: {"Content-Type": "application/json"}}
      );
    } */}

    //Generate unique cache key based on query and the URLs
    const cacheKey = `chat:${url}`;
    // Check Redis to see if a cached result is already available
    const cachedResult = await redis.get(cacheKey)
    if (cachedResult) {
      //If cached data is found, return it immediately
      return new Response(JSON.stringify(cachedResult), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      });
    }

    //Scrape content of each ULR in parallel by calling the function of scrapping above
    let scrapedContents = ''
    let sources = ''
    if(url){
      scrapedContents = await scrapeURL(url);
      sources = url
    }
    
    const currentDate = new Date().toISOString();
    const systemPrompt = systemPrompt_prev
      .replace('{context}', scrapedContents)
      .replace('{date}', currentDate);
    // Contruct a prompt for the LLM by labeling each source with an index 
    //TODO LATER the LLM labeling caching
    //const systemPrompt = scrapedContents.map((c, i) => `Source [${i + 1}]:\n${c}`).join('\n\n');
    //Create message array for the LLM, including instructions and the user's query
    
    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {role: 'user', content: query}
    ];

     //Send the prompt to the LLM via GROQ 
     const completion = await Client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: messages as any,
     });

     //Extract the answer from completion response, empty string if it missing
     const answer = completion.choices?.[0]?.message?.content || 'No response';
     //Construct the final result obj including url as sources
     const result = {answer, sources: url};

     //Store result in redis with  TTL(time to live) for 24 hours
     await redis.set(cacheKey, JSON.stringify(result), {ex: 3600});

     //Return result 200 if OK
     return new Response(JSON.stringify(result), {status: 200, headers: {"Content-Type": "application/json"}});

  } catch (error: any) {
    return new Response(JSON.stringify({error: error.message}), {status:500, headers:{"Content-Type":"application/json"}});
  }
}