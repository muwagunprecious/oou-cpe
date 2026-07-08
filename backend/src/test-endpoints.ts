async function test() {
  try {
    console.log("Testing health check...");
    const res = await fetch("http://localhost:5000/api/health");
    console.log("Health Check Status:", res.status);
    console.log("Health Check Response:", await res.json());
  } catch (err) {
    console.error("Test failed:", err);
  }
}
test();
