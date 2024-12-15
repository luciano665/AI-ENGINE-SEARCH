import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';



//List of user agents for diff Browsers



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
