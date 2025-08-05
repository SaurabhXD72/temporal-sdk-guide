/** 
 * Activity that generates a personalized greeting
 * Activities run in the worker process and can perform side effects
 */
export async function sayHello(name: string): Promise<string> {
    console.log(`Processing greeting for: ${name}`);
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return `Hello, ${name}! Welcome to Temporal.`;
  }
  