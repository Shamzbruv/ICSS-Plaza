import {fail} from './model.js';

// The publishable legacy anon key is scoped to this public Auth API.
// Authorization pins one admin-created identity by both email and UUID.
export const plazaAuth=Object.freeze({
 url:'https://twyihgetuuuievxfgfti.supabase.co/auth/v1',
 anon:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3eWloZ2V0dXV1aWV2eGZnZnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1NzU2MTAsImV4cCI6MjExMDE1MTYxMH0.Ppy3BkAtgD-_Gvncd7SexHfKtkL6z-CAb24fW0uJaqU',
 userId:'1c005a86-4e40-4837-832d-333d77816013'
});

export function developerAuth(config=plazaAuth,fetcher=fetch){
 const call=(path,method,body,token)=>fetcher(config.url+path,{
   method,headers:{apikey:config.anon,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)
 }).catch(()=>fail('Developer sign-in is temporarily unavailable.',503));
 const authenticate=async(email,password)=>{
  const response=await call('/token?grant_type=password','POST',{email,password});
  if([400,401,403,422].includes(response.status))fail('Email or password is incorrect.',401);
  if(!response.ok)fail('Developer sign-in is temporarily unavailable.',503);
  const data=await response.json();
  if(data.user?.id!==config.userId||data.user?.email!==email||!data.access_token)fail('Developer access is not authorised.',403);
  return data.access_token;
 };
 const release=token=>call('/logout?scope=local','POST',null,token).catch(()=>{});
 return {
  id:config.userId,
  async verify(email,password){const token=await authenticate(email,password);await release(token);},
  async changePassword(email,current,password){
   const token=await authenticate(email,current);
   try{
    const response=await call('/user','PUT',{password},token);
    if([400,422].includes(response.status))fail('Supabase rejected the new password. Choose a different password.');
    if(!response.ok)fail('Developer password change is temporarily unavailable.',503);
   }finally{await release(token);}
  }
 };
}
