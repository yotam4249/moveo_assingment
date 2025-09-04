import initApp from "./server";

const PORT = Number(process.env.PORT || 3000);

initApp()
  .then((app) => {
    app.listen(PORT, () => {
      console.log(`🚀 Listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to init app:", err);
    process.exit(1);
  });
