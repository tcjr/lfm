<template>
  <div class="min-h-screen w-full mx-auto px-4 bg-base-100">
    {{outlet}}
  </div>

  <footer class="text-base-content">
    <div class="footer footer-center p-10 bg-base-200">

      {{! Socials }}
      <nav class="grid grid-flow-col gap-6" aria-label="socials links">

        <a class="btn btn-ghost btn-sm" href="https://bsky.app/profile/tcjr.org">
          BlueSky
        </a>
        <a class="btn btn-ghost btn-sm" href="https://github.com/tcjr">
          GitHub
        </a>
        <a class="btn btn-ghost btn-sm" href="https://tangled.org/tcjr.org">
          Tangled
        </a>
      </nav>

      {{! Links }}
      <nav aria-label="site links">
        <div class="flex flex-wrap justify-center gap-y-2 gap-x-6 text-lg">
          <a class="link link-hover" href="/">Home</a>
        </div>
      </nav>
    </div>

    {{! Brand }}
    <aside
      class="bg-base-300 py-4 px-8 w-full flex gap-2 flex-wrap justify-between items-center text-sm"
    >
      <p></p>
      <p>Made in Chicago - tcjr</p>
    </aside>
  </footer>
</template>
