// A lightweight check that Netlify Functions are deployed and executable.
export default async function handler() {
  return new Response(JSON.stringify({status: 'ok', service: 'Skolesekken', time: new Date().toISOString()}), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
