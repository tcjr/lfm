import { LinkTo } from '@ember/routing';

<template>
  <ul class="menu">
    <li><LinkTo @route="scrobbles.index" class="link">Scrobbles</LinkTo></li>
    <li><LinkTo @route="scrobbles.recent" class="link">Recent Scrobbles</LinkTo></li>
  </ul>
</template>
