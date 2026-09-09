// Vercel Function for POST /api/subscribe-result (Web-standard handler signature).
// Requires MAILERLITE_API_TOKEN and MAILERLITE_GROUP_ID in the Vercel project environment.
import {subscribe} from '../server/subscribe.mjs';

const env={MAILERLITE_API_TOKEN:process.env.MAILERLITE_API_TOKEN,MAILERLITE_GROUP_ID:process.env.MAILERLITE_GROUP_ID};
const handler=request=>subscribe(request,env);

export const POST=handler;
export const GET=handler;
export const HEAD=handler;
export const PUT=handler;
export const PATCH=handler;
export const DELETE=handler;
export const OPTIONS=handler;
