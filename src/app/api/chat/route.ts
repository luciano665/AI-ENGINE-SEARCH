// TODO: Implement the chat API with Groq and web scraping with Cheerio and Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import {Groq} from 'groq-sdk';
import {Redis} from '@upstash/redis';


interface ChatRequestBody {
  query: string;
  urls: string[];
}

//Redis init 
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL_!,
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

//Handles the incoming requests, scrapes URLs queries to LLM and returns the response.
export async function POST(req: Request) {
  try {
    // Parse the request bodyy as the ChatrequestBody
    const {query, urls} = await req.json() as ChatRequestBody;
    // Validate that query and the urls are provided and urls is not empty  (for now later provide response based on LLM only)
    if (!query || !Array.isArray(urls) || urls.length === 0) {
      // If invalid
      return new Response(JSON.stringify({error: 'Invalid input.'}), {status: 400});
    }

    //Generate unique cache key based on query and the URLs
    const cacheKey = `chat:${query}:${urls.join('|')}`;
    // Check Redis to see if a cached result is already available
    const cached = await redis.get(cacheKey);
    if (cached) {
      //If cached data is found, return it inmediatly
      return new Response(JSON.stringify(cached), {status: 200});
    }

    //Scrape content of each ULR in parallel by calling the function of scrapping above
    const scrapedContents = await Promise.all(urls.map((u) => scrapeURL(u)))
    // Contruct a prompt for the LLM by labeling each source with an index
    const systemPrompt = scrapedContents.map((c, i) => `Source [${i + 1}]:\n${c}`).join('\n\n');
    //Create message array for the LLM, including instructions and the user's query
    const messages = [
      {
        role: 'system',
        content: `You are helpful assistant that responds to user queries using reals sources and actual up to date. Use this sources to answer the user's query and always cite relevant sources in your responses when needed.
        If unsure, use your knowledge .\n\n${systemPrompt}`
      },
      {role: 'user', content: query}
    ];

     //Send the prompt to the LLM via GROQ 
     const completion = await Client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages as any,
     });

     //Extract the answer from completion response, empty string if it missing
     const answer = completion.choices?.[0]?.message?.content || 'No response';
     //Construct the final result obj including url as sources
     const result = {answer, sources: urls};

     //Store result in redis with  TTL(time to live) for 24 hours
     await redis.set(cacheKey, result, {ex: 3600});

     //Return result 200 if OK
     return new Response(JSON.stringify(result), {status: 200});

  } catch (error: any) {
    return new Response(JSON.stringify({error: error.message}), {status:500});
  }
}
