<script>
  let text = "Hello, world! This is a test app.";
</script>

<main>
  <h1>{text}</h1>
  <p>This is a simple test.</p>
</main>

<style>
  main {
    text-align: center;
    padding: 0;
    max-width: 240px;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style> 