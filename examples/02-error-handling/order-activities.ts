export interface InventoryItem {
    productId: string;
    quantity: number;
  }
  
  /**
   * Validates customer payment method
   * Simulates potential payment failures for demonstration
   */
  export async function validatePayment(customerId: string, paymentMethod: string): Promise<void> {
    console.log(`Validating payment for customer ${customerId}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate 20% failure rate for demonstration
    if (Math.random() < 0.05) { ///Reduced to 5% failure rate
      throw new Error(`Payment validation failed for customer ${customerId}`);
    }
    
    console.log(`Payment validated for customer ${customerId}`);
  }
  
  /**
   * Reserves inventory for order items
   * Demonstrates retry-able business logic
   */
  export async function reserveInventory(items: InventoryItem[]): Promise<void> {
    console.log(`Reserving inventory for ${items.length} items`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate occasional inventory issues
    if (Math.random() < 0.05) { // Reduced to 5% failure rate
      throw new Error('Insufficient inventory available');
    }
    
    console.log('Inventory reserved successfully');
  }
  
  /**
   * Processes shipment for the order
   */
  export async function processShipment(orderId: string, items: InventoryItem[]): Promise<void> {
    console.log(`Processing shipment for order ${orderId}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`Shipment processed for order ${orderId}`);
  }
  
  /**
   * Sends notifications to customers
   */
  export async function sendNotification(
    customerId: string, 
    type: 'ORDER_CONFIRMED' | 'ORDER_FAILED', 
    orderId: string
  ): Promise<void> {
    console.log(`Sending ${type} notification to customer ${customerId} for order ${orderId}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`Notification sent successfully`);
  }
  
  /**
   * Compensation activity: releases reserved inventory
   */
  export async function releaseInventory(items: InventoryItem[]): Promise<void> {
    console.log(`Releasing reserved inventory for ${items.length} items`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Inventory released successfully');
  }
  
  /**
   * Compensation activity: refunds customer payment
   */
  export async function refundPayment(customerId: string, orderId: string): Promise<void> {
    console.log(`Processing refund for customer ${customerId}, order ${orderId}`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log(`Refund processed for order ${orderId}`);
  }
  