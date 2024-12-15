import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';



//List of user agents for diff Browsers
const USER_AGENTS = [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36', // Chrome on Linux
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', // Chrome on Windows
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', // Chrome on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.0.3 Safari/537.36', // Safari on macOS
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0', // Firefox on Windows
    'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0', // Firefox on Linux
];

/**
 * Picks a random user agent from the list of user agents 
 */
function getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}



/**
 * Interface representing the structre of scrapped content.
 */
export interface ScrapedContent {
    url: string,
    title: string, 
    headings: {
        h1: string, 
        h2: string,
    };
    metaDescription: string,
    content: string, 
    error: string | null;
}

/**
 * Cleans text by removing excessive whitespace and line breaks.
 * @param text - The text to clean
 * @returns Cleaned text
 */
function cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
}


/**
 * Scrapping URL's content using Puppeter & Cheerio
 */
export async function scrapeURL(url: string): Promise<ScrapedContent> {
    // Launch a new headless browser instance 
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
    
        // Set a reasonable timeout and navigate to the URL
        await page.goto(url, { waitUntil: 'networkidle2'});
    
        // Retrieve the full HTML content of the page
        const html = await page.content();
    
        // Load HTML into Cheerio for parsing
        const $ = cheerio.load(html);
    
        // Remove unwanted elements to clean up the content
        $('script, style, noscript, iframe').remove();
    
        // Extract various elements from the page
        const title = cleanText($('title').text());
        const metaDescription = cleanText($('meta[name="description"]').attr('content') || '');
        const h1 = cleanText(
          $('h1')
            .map((_, el) => $(el).text())
            .get()
            .join(' ')
        );
        const h2 = cleanText(
          $('h2')
            .map((_, el) => $(el).text())
            .get()
            .join(' ')
        );
        const articleText = cleanText(
          $('article')
            .map((_, el) => $(el).text())
            .get()
            .join(' ')
        );
        const mainText = cleanText(
          $('main')
            .map((_, el) => $(el).text())
            .get()
            .join(' ')
        );
        const contentText = cleanText(
          $('.content, #content, [class*="content"]')
            .map((_, el) => $(el).text())
            .get()
            .join(' ')
        );
        const paragraphs = cleanText(
          $('p')
            .map((_, el) => $(el).text())
            .get()
            .join(' ')
        );
        const listItems = cleanText(
          $('li')
            .map((_, el) => $(el).text())
            .get()
            .join(' ')
        );
    
        // Combine all extracted content into a single string
        let combinedContent = [
          title,
          metaDescription,
          h1,
          h2,
          articleText,
          mainText,
          contentText,
          paragraphs,
          listItems,
        ].join(' ');
    
        // Limit the combined content to 40,000 characters to prevent excessive data
        combinedContent = combinedContent.slice(0, 40000);
    
    
        return {
          url,
          title,
          headings: { h1, h2 },
          metaDescription,
          content: combinedContent,
          error: null,
        };
      } catch (error) {
        console.error(`Error scraping URL ${url}:`, error);
        return {
          url,
          title: '',
          headings: { h1: '', h2: '' },
          metaDescription: '',
          content: '',
          error: 'Failed to scrape URL',
        };
      } finally {
        // Ensure the browser is closed to free up resources
        await browser.close();
      }
}

/**
 * Performs a Google search and extracts first URL to return to be scrapped later
 */
export async function searchGoogle(query:string): Promise<string | null> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    try{
        const page = await browser.newPage();

        //Set a random user agent
        const userAgent = getRandomUserAgent();
        await page.setUserAgent(userAgent);

        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
        await page.goto(searchUrl, {waitUntil: "networkidle2"});

        const firstResult = await page.evaluate(() => {
            const link = document.querySelector("a[href]");
            return link ? (link as HTMLAnchorElement).href : null;
        });

        return firstResult;
    } catch (error) {
        console.log("Search error", error);
        return null;
    } finally {
        await browser.close()
    }
}
/**
 * Handles the scrapping from a URL or performing a search if URL is not provided
 */
export async function scrapeAndSearch(query: string): Promise<ScrapedContent> {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const url = query.match(urlRegex) ? query : await searchGoogle(query);

    if(!url) {
        return {
            url : "",
            title: "",
            headings: {h1:"", h2:""},
            metaDescription: "",
            content: "",
            error: "No results found for the query",
        }
    }

    return await scrapeURL(url);
   
}
