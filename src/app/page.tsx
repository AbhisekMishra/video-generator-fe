'use client';

import { supabaseClient } from "./lib/supabase";

export default function Home() {
  const handleSignInWithGoogle = async () => {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) {
      console.error('Error signing in with Google:', error.message);
    }
  };

  return (
    <div>
      <h1>Sign in with Google</h1>
      <button onClick={handleSignInWithGoogle}>Sign in with Google</button>
    </div>
  );
}
