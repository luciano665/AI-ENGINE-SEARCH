// scraper.ts

// Importing necessary libraries and modules
import * as cheerio from 'cheerio'; // Cheerio is used for parsing and manipulating HTML on the server side, similar to jQuery.
import puppeteer from 'puppeteer'; // Puppeteer provides a high-level API to control Chrome or Chromium over the DevTools Protocol, useful for scraping dynamic content.
import { Redis } from "@upstash/redis"; // Upstash Redis client for interacting with Redis, used here for caching scraped data.
import axios from "axios"; // Axios is a promise-based HTTP client for making requests to fetch webpage content.

// Initialize Redis for caching scraped content.
// The Redis client is configured using environment variables for the URL and token.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!, // The Redis REST API URL, expected to be set in environment variables.
  token: process.env.UPSTASH_REDIS_REST_TOKEN!, // The Redis REST API token, expected to be set in environment variables.
});

const MAX_CACHE_SIZE = 1_000_000; // 1MB - Maximum size of cached content to prevent excessive memory usage.
const CACHE_EXPIRATION = 7 * 24 * 60 * 60; // 7 days in seconds - Duration after which cached content expires.

// List of user agents for different browsers.
// Using diverse user agents helps in mimicking requests from various browsers, reducing the risk of being blocked by target websites.
const USER_AGENTS = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36', // Chrome on Linux
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', // Chrome on Windows
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.0.3 Safari/537.36', // Safari on macOS
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0', // Firefox on Windows
  'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0', // Firefox on Linux
];

/**
 * Picks a random user agent from the list of user agents.
 * This function helps in rotating user agents to mimic requests from different browsers,
 * thereby reducing the likelihood of being detected or blocked by target websites.
 * @returns A randomly selected user agent string.
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Interface representing the structure of scraped content.
 * Defines the shape of the data returned after scraping a webpage.
 */
export interface ScrapedContent {
  url: string; // The URL of the scraped webpage.
  title: string; // The content of the <title> tag.
  headings: {
    h1: string; // Combined text from all <h1> tags.
    h2: string; // Combined text from all <h2> tags.
  };
  metaDescription: string; // Content of the <meta name="description"> tag.
  content: string; // Main textual content extracted from the page.
  error: string | null; // Error message if scraping fails, otherwise null.
}

/**
 * Cleans text by removing excessive whitespace and line breaks.
 * This function ensures that the extracted text is readable and free from unnecessary formatting.
 * @param text - The text to clean.
 * @returns Cleaned text.
 */
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
}

/**
 * Determines whether to use Cheerio or Puppeteer based on the page's content.
 * Cheerio is suitable for static pages, while Puppeteer is needed for dynamic pages that require JavaScript execution.
 * @param url - The URL to analyze.
 * @returns A promise that resolves to either "cheerio" or "puppeteer".
 */
async function determineScrapingMethod(url: string): Promise<"cheerio" | "puppeteer"> {
  try {
    // Fetch the webpage content using axios with a random user agent to mimic different browsers.
    const response = await axios.get(url, {
      headers: { "User-Agent": getRandomUserAgent() },
      timeout: 10000, // 10 seconds timeout to prevent hanging requests.
    });
    const html = response.data; // Raw HTML of the fetched webpage.

    // Define indicators that suggest the presence of client-side rendering or dynamic content.
    // These indicators are commonly found in pages built with frameworks like React, Angular, Vue, etc.
    const needsPuppeteer = [
      "window.__INITIAL_STATE__",
      "window.__NUXT__",
      "window.__NEXT_DATA__",
      "react",
      "angular",
      "vue",
      "_next/static",
      "data-reactroot",
      "data-v-",
      "<script src="
    ].some((indicator) => html.includes(indicator)); // Check if any indicator is present in the HTML.

    // Decide the scraping method based on the presence of dynamic content indicators.
    return needsPuppeteer ? "puppeteer" : "cheerio";
  } catch (error) {
    console.error(`Error determining scraping method for ${url}:`, error);
    // Default to Puppeteer if there's an error fetching the page to ensure dynamic content is handled.
    return "puppeteer";
  }
}

/**
 * Extracts top search results from Google using a simple approach.
 * It fetches the Google search results page and parses it to extract titles and links.
 * @param query - The search query.
 * @param maxResults - Maximum number of results to retrieve (default is 3).
 * @returns An array of search results, each containing a title and link.
 */
const getTopResultsFromGoogle = async (
  query: string,
  maxResults: number = 3
): Promise<{ title: string; link: string }[]> => {
  try {
    // Make a GET request to Google's search endpoint with the encoded query and a random user agent.
    const response = await axios.get(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      {
        headers: { "User-Agent": getRandomUserAgent() },
      }
    );

    const html = response.data; // Raw HTML of the Google search results page.
    const $ = cheerio.load(html); // Load the HTML into Cheerio for parsing.
    const searchResults: { title: string; link: string }[] = []; // Initialize an array to store search results.

    // Select all div elements with class 'g', which typically contain individual search results.
    $("div.g").each((_, element) => {
      const title = $(element).find("h3").text(); // Extract the title from the <h3> tag within the search result.
      let link = $(element).find("a").attr("href"); // Extract the href attribute from the <a> tag.

      // Google search results often have URLs like "/url?q=actualURL&...".
      // This pattern is used for tracking clicks and redirection.
      if (link && link.startsWith("/url?q=")) {
        // Decode the actual URL by splitting and decoding the query parameter.
        link = decodeURIComponent(link.split("/url?q=")[1].split("&")[0]);
      }

      // Ensure that both title and link are present and the link does not point back to Google itself.
      if (title && link && !link.includes("google.com")) {
        searchResults.push({ title, link }); // Add the result to the array.
      }

      // Continue iterating until the desired number of results is reached.
      return searchResults.length < maxResults;
    });

    // Return only the top 'maxResults' search results.
    return searchResults.slice(0, maxResults);
  } catch (error) {
    console.error("Error fetching Google search results:", error);
    return []; // Return an empty array if there's an error during the search.
  }
};

/**
 * Scrapes a web page using Puppeteer for dynamic content, returning the *raw HTML*.
 * Puppeteer is used when the page relies heavily on JavaScript for rendering content.
 * @param url - The URL to scrape.
 * @returns A promise that resolves to the raw HTML content of the page.
 */
const scrapeWithPuppeteer = async (url: string): Promise<string> => {
  // Launch a new Puppeteer browser instance in headless mode with specific arguments for security and performance.
  const browser = await puppeteer.launch({
    headless: true, // Run in headless mode (no GUI).
    args: ["--no-sandbox", "--disable-setuid-sandbox"], // Security flags to prevent sandboxing issues.
  });

  try {
    const page = await browser.newPage(); // Open a new browser page.

    // Set a random user agent to mimic different browsers.
    await page.setUserAgent(getRandomUserAgent());

    // Navigate to the target URL and wait until the network is idle (no more network connections for at least 500ms).
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 }); // 30 seconds timeout.

    // Retrieve the fully loaded page content as raw HTML.
    const content = await page.content();
    return content; // Return the raw HTML.
  } catch (error) {
    console.error(`Error scraping with Puppeteer for ${url}:`, error);
    return ""; // Return an empty string if scraping fails.
  } finally {
    await browser.close(); // Ensure the browser is closed to free up resources.
  }
};

/**
 * Scrapes a web page using Cheerio for static content, returning the *raw HTML*.
 * Cheerio is used for pages that do not require JavaScript execution.
 * @param url - The URL to scrape.
 * @returns A promise that resolves to the raw HTML content of the page.
 */
const scrapeWithCheerio = async (url: string): Promise<string> => {
  try {
    // Make a GET request to the target URL with a random user agent to mimic different browsers.
    const response = await axios.get(url, {
      headers: { "User-Agent": getRandomUserAgent() },
      timeout: 10000, // 10 seconds timeout to prevent hanging requests.
    });
    // Return the raw HTML string of the fetched page.
    return response.data;
  } catch (error) {
    console.error(`Error scraping with Cheerio for ${url}:`, error);
    return ""; // Return an empty string if scraping fails.
  }
};

/**
 * Retrieves the *raw HTML* from a page using Cheerio or Puppeteer, caching it in Redis.
 * This function checks the cache first to avoid redundant scraping and stores the result for future use.
 * @param url - The URL to scrape.
 * @returns A promise that resolves to the raw HTML string of the page.
 */
const getRawHtml = async (url: string): Promise<string> => {
  // Define a unique cache key based on the URL to store and retrieve cached content.
  const cacheKey = `scrapeRawHtml:${url}`;
  
  // Attempt to retrieve the raw HTML from Redis cache.
  const cachedRawHtml: string | null = await redis.get<string>(cacheKey);
  if (typeof cachedRawHtml === 'string') {
    console.log(`Cache hit for RAW HTML: ${url}`);
    return cachedRawHtml; // Return cached HTML if available.
  }

  // Determine the appropriate scraping method based on the page's content.
  const method = await determineScrapingMethod(url);
  console.log(`Scraping method for ${url}: ${method}`);

  let rawHtml = "";
  if (method === "puppeteer") {
    rawHtml = await scrapeWithPuppeteer(url); // Use Puppeteer for dynamic content.
  } else {
    rawHtml = await scrapeWithCheerio(url); // Use Cheerio for static content.
  }

  if (rawHtml) {
    // Truncate the HTML to the maximum cache size to prevent excessive storage.
    const truncated = rawHtml.slice(0, MAX_CACHE_SIZE);
    // Store the truncated HTML in Redis with an expiration time.
    await redis.set(cacheKey, truncated, { ex: CACHE_EXPIRATION });
    console.log(`Cached RAW HTML for ${url}`);
  }

  return rawHtml; // Return the raw HTML (truncated if necessary).
};

/**
 * Extracts meaningful text content from raw HTML, removing scripts, styles, etc.
 * This function focuses on extracting the main textual content of the page.
 * @param rawHtml - The raw HTML string of the webpage.
 * @returns A cleaned and consolidated string of the main content.
 */
function extractMainContent(rawHtml: string): string {
  const $ = cheerio.load(rawHtml); // Load the raw HTML into Cheerio for parsing.

  // Remove unwanted elements that do not contribute to the main content.
  $("script, style, header, footer, aside, nav").remove();

  // Define selectors that typically contain the main content of the page.
  const selectors = ["article", "main", ".content", "#content", ".post", ".article", '[role="main"]'];
  let mainText = "";

  // Iterate through each selector to extract and accumulate text content.
  for (const sel of selectors) {
    const text = cleanText($(sel).text() || ""); // Extract and clean text from the selector.
    if (text.length > mainText.length) {
      mainText = text; // Select the largest chunk of text found.
    }
  }

  // Fallback to the entire body text if no specific selectors matched.
  if (!mainText) {
    mainText = cleanText($("body").text() || "");
  }

  return mainText; // Return the extracted main content.
}

/**
 * Performs a Google search and retrieves the top result link.
 * If no results are found, it returns null.
 * @param query - The search query.
 * @returns A promise that resolves to the top result URL or null if no results are found.
 */
export async function searchGoogle(query: string): Promise<string | null> {
  try {
    const searchResults = await getTopResultsFromGoogle(query, 1); // Retrieve only the top result.
    if (searchResults.length > 0) {
      console.log(`Top Google result for "${query}": ${searchResults[0].link}`);
      return searchResults[0].link; // Return the link of the top result.
    }
    return null; // Return null if no results are found.
  } catch (error) {
    console.error(`Error performing Google search for "${query}":`, error);
    return null; // Return null in case of an error.
  }
}

/**
 * Scrapes the content from a given URL. This function:
 * 1) Fetches raw HTML (via Cheerio or Puppeteer),
 * 2) Parses the HTML to extract <title>, <meta description>, <h1>, <h2>,
 * 3) Extracts main textual content,
 * 4) Caches the final ScrapedContent in Redis.
 * @param url - The URL to scrape.
 * @returns A promise that resolves to a ScrapedContent object containing extracted data.
 */
export async function scrapeURL(url: string): Promise<ScrapedContent> {
  // Define a unique cache key for the structured ScrapedContent based on the URL.
  const cacheKey = `scrapedContent:${url}`;

  // Attempt to retrieve the structured ScrapedContent from Redis cache.
  const cached: string | null = await redis.get<string>(cacheKey);
  if (typeof cached == 'string') {
    console.log(`Cache hit for structured ScrapedContent: ${url}`);
    return JSON.parse(cached); // Parse and return cached content if available.
  }

  // Initialize the ScrapedContent object with default values.
  const scrapedContent: ScrapedContent = {
    url,
    title: "",
    headings: { h1: "", h2: "" },
    metaDescription: "",
    content: "",
    error: null,
  };

  try {
    // 1) Retrieve the raw HTML of the webpage (uses caching internally).
    const rawHtml = await getRawHtml(url);
    if (!rawHtml) {
      scrapedContent.error = "Failed to fetch raw HTML.";
      return scrapedContent; // Return with an error if fetching raw HTML fails.
    }

    // 2) Parse the raw HTML using Cheerio to extract specific elements.
    const $ = cheerio.load(rawHtml);

    // Extract and clean the <title> tag content.
    const title = cleanText($("title").text());
    // Extract and clean the <meta name="description"> tag content.
    const metaDescription = cleanText($('meta[name="description"]').attr("content") || "");
    // Extract and clean all <h1> tag contents, concatenated into a single string.
    const h1Text = $("h1").map((_, el) => $(el).text()).get().join(" ");
    // Extract and clean all <h2> tag contents, concatenated into a single string.
    const h2Text = $("h2").map((_, el) => $(el).text()).get().join(" ");

    // Assign the extracted values to the ScrapedContent object.
    scrapedContent.title = cleanText(title);
    scrapedContent.metaDescription = metaDescription;
    scrapedContent.headings.h1 = cleanText(h1Text);
    scrapedContent.headings.h2 = cleanText(h2Text);

    // 3) Extract the main textual content from the raw HTML.
    let mainContent = extractMainContent(rawHtml);
    // Limit the combined content to 40,000 characters to prevent excessive data handling.
    mainContent = mainContent.slice(0, 40000);

    // Assign the main content to the ScrapedContent object.
    scrapedContent.content = mainContent;

    // 4) Cache the final structured content in Redis with an expiration time.
    await redis.set(cacheKey, JSON.stringify(scrapedContent), { ex: CACHE_EXPIRATION });
    console.log(`Cached structured ScrapedContent for: ${url}`);
    
    return scrapedContent; // Return the fully populated ScrapedContent object.
  } catch (error) {
    console.error(`Error scraping URL ${url}:`, error);
    // Return the ScrapedContent object with an error message in case of failure.
    return {
      ...scrapedContent,
      error: "Failed to scrape URL",
    };
  }
}

/**
 * Handles scraping from a URL or performing a search if URL is not provided.
 * If `query` is not a URL, it performs a Google search to find the top result and scrapes that result.
 * @param query - The search query string or a direct URL.
 * @returns A promise that resolves to a ScrapedContent object containing extracted data.
 */
export async function scrapeAndSearch(query: string): Promise<ScrapedContent> {
  // 1) Try to interpret the query as a direct URL.
  try {
    // Attempt to construct a URL object from the query string.
    const maybeUrl = new URL(query);
    // If successful, the query is a valid URL, so scrape it directly.
    return await scrapeURL(maybeUrl.toString());
  } catch {
    // If constructing a URL fails, the query is not a valid URL, proceed with Google search.
  }

  // 2) Perform a Google search to get the top result URL.
  const topUrl = await searchGoogle(query);
  if (!topUrl) {
    // If no search results are found, return a ScrapedContent object with an error.
    return {
      url: "",
      title: "",
      headings: { h1: "", h2: "" },
      metaDescription: "",
      content: "",
      error: "No results found for the query",
    };
  }

  // 3) Scrape the top search result URL.
  const scrapedContent = await scrapeURL(topUrl);
  if (scrapedContent.error) {
    // If scraping the top result fails, return a ScrapedContent object with an error.
    return {
      ...scrapedContent,
      error: "Failed to scrape the content",
    };
  }

  return scrapedContent; // Return the successfully scraped content.
}
