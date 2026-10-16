// This Next.js app is API-only. The UI lives in ../frontend (Vite, http://localhost:5173).
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Reallocation API</h1>
      <p>
        API-only server. Try <a href="/api/health">/api/health</a>. The UI runs from the frontend folder.
      </p>
    </main>
  );
}
