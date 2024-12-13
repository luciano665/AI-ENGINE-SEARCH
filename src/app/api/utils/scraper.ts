import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';


/**
 * Scrapping URL's content using Puppeter & Cheerio
 */
export async function scrapeURL(url: string): Promise<string> {
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
