---
layout: home

hero:
  name: Backend Atlas
  text: Backend engineering, below the framework.
  tagline: A map of how backends really work — protocols, connections, threads and proxies — with the real-world situations where each concept shows up.
  image:
    src: /logo.svg
    alt: Backend Atlas
  actions:
    - theme: brand
      text: Start with the 80/20 Path
      link: /pareto
    - theme: alt
      text: Browse the Concept Index
      link: /concepts
    - theme: alt
      text: Start from the top
      link: /communication/request-response
---

<div class="map-intro">
  <h2>The map</h2>
  <p>Pick a region. Every page lists its concepts in the right-hand outline, and <kbd>Ctrl</kbd> + <kbd>K</kbd> searches everything.</p>
</div>

<SectionMap />

<style>
.map-intro {
  max-width: 1152px;
  margin: 48px auto 20px;
  padding: 0 24px;
}
.map-intro h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 6px;
}
.map-intro p {
  color: var(--vp-c-text-2);
  margin: 0;
}
.map-intro kbd {
  font-size: 12px;
  padding: 1px 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
}
@media (max-width: 640px) {
  .map-intro { padding: 0 16px; }
}
</style>
