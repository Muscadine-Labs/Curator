#!/usr/bin/env tsx
/**
 * Test script to verify WalletConnect project ID is working
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';

async function testWalletConnect() {
  console.log(`Testing WalletConnect project ID: ${PROJECT_ID}\n`);

  const url = `https://api.web3modal.org/appkit/v1/config?projectId=${PROJECT_ID}&st=appkit&sv=html-core-1.7.8`;
  console.log(`Testing URL: ${url}\n`);

  try {
    const response = await fetch(url);
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    console.log(`Response OK: ${response.ok}`);
    console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log(`\n✅ Success! Response data:`, JSON.stringify(data, null, 2));
      console.log(`\n✅ WalletConnect project ID is valid and working!`);
    } else {
      const errorText = await response.text();
      console.log(`\n❌ Error Response:`, errorText);
      console.log(`\n❌ WalletConnect project ID may be invalid or expired.`);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  }
}

testWalletConnect();

