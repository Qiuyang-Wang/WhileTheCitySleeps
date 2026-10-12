/* The document provides scroll distance. Scenes stay fixed and crossfade in place.
   Every visual state comes from scroll position, so reverse scrolling works too. */
const SETTINGS = {
  fadeViewport: 0.70, // Transition length, as a fraction of the screen height.
  lights: [0.25, 0.50], doors: [0.50, 0.75], zoom: [0.75, 1],
  storeZoom: 0.20
};
const sections = [...document.querySelectorAll('.story-section')];
const notesSection = document.querySelector('.notes-section');
const scenes = [...sections.map(section => section.querySelector('.sticky-scene')), document.querySelector('.credits')];
const timelineLinks = [...document.querySelectorAll('.timeline a')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp = value => Math.max(0, Math.min(1, value));
const range = (progress, start, end) => clamp((progress - start) / (end - start));
const set = (element, name, value) => element.style.setProperty(name, value);
let sectionBounds = [], fadeDistance = 0, framePending = false;
let storySounds;

function measureSections() {
  fadeDistance = innerHeight * SETTINGS.fadeViewport;
  const referencePerson = document.querySelector('#starts .entering');
  const referenceCounter = document.querySelector('#starts .counter-small');
  const standingLeft = referenceCounter.offsetLeft + (referenceCounter.offsetWidth - referencePerson.offsetWidth) / 2;
  ['workers', 'low'].forEach(id => set(document.getElementById(id), '--counter-person-left', `${standingLeft}px`));
  sectionBounds = [...sections, notesSection].map(section => ({
    top: section.offsetTop,
    travel: Math.max(1, section.offsetHeight - fadeDistance)
  }));
  requestUpdate();
}
function updateStoreScene(section, progress, opening = true) {
  const stage = section.querySelector('.store-stage');
  set(stage, '--lights', range(progress, ...(opening ? SETTINGS.lights : [0.1, 0.5])));
  if (!opening) {
    const reveal = range(progress, 0.62, 0.92);
    set(section, '--return-person-opacity', reveal * reveal * (3 - 2 * reveal));
    return;
  }
  set(stage, '--door-opacity', range(progress, 0.48, 0.51));
  set(stage, '--door-open', range(progress, ...SETTINGS.doors));
  set(stage, '--store-scale', reducedMotion.matches ? 1 : 1 + SETTINGS.storeZoom * range(progress, ...SETTINGS.zoom));
}
function updateCharacterScene(section, progress) {
  const person = section.querySelector('.entering');
  const counter = section.querySelector('.counter-small');
  const movement = range(progress, 0.08, 0.78);
  const walkDistance = counter.offsetLeft + (counter.offsetWidth - person.offsetWidth) / 2 - person.offsetLeft;
  set(person, '--walk-x', `${movement * walkDistance}px`);
  set(person, '--walk-opacity', range(progress, 0.08, 0.42));
}
function updateWorkload(section, progress) {
  const active = Math.min(3, Math.floor(progress * 4));
  const ease = value => value * value * (3 - 2 * value);
  section.querySelectorAll('.task').forEach((task, index) => {
    const phase = clamp(progress * 4 - index);
    const image = ease(range(phase, 0.42, 0.62));
    // Each task repeats the same sequence: small circle, larger circle, picture.
    // Completed thoughts stay visible together until the page crossfades away.
    task.style.opacity = phase > 0 ? 1 : 0;
    set(task, '--thought-small', ease(range(phase, 0.06, 0.20)));
    set(task, '--thought-large', ease(range(phase, 0.23, 0.38)));
    set(task, '--thought-image', image);
    task.setAttribute('aria-hidden', String(image === 0));
  });
  section.querySelectorAll('.task-progress i').forEach((dot, index) => dot.classList.toggle('active', index === active));
}
function updateWorkers(section, progress) {
  const motions = [
    { selector: '.worker-a', start: 0.02, end: 0.4, offset: -innerWidth * 0.30 },
    { selector: '.worker-b', start: 0.25, end: 0.68, offset: innerWidth * 0.46 },
    { selector: '.customer', start: 0.55, end: 1, offset: -innerWidth * 0.3 }
  ];
  motions.forEach(({ selector, start, end, offset }) => {
    const person = section.querySelector(selector);
    const amount = range(progress, start, end);
    person.style.opacity = range(progress, start, start + 0.13);
    const travel = selector === '.customer' ? offset + amount * innerWidth * 0.8 : offset * (1 - amount);
    person.style.transform = `translateX(${travel}px)`;
  });
}
function updateFatigue(section, progress) {
  const ease = value => value * value * (3 - 2 * value);
  const expression = ease(range(progress, 0.10, 0.40));
  const falling = reducedMotion.matches ? 0 : ease(range(progress, 0.45, 0.92));
  set(section, '--room-light', 0.6 - progress * 0.48);
  set(section, '--tired-expression', expression);
  set(section, '--tired-y', `${falling * innerHeight * 0.03}px`);
  set(section, '--tired-angle', `${falling * -25}deg`);
}
function updateMorning(section, progress) {
  const ease = value => value * value * (3 - 2 * value);
  const walking = reducedMotion.matches ? 0.5 : ease(range(progress, 0, 0.28));
  const breakfast = reducedMotion.matches ? Number(progress >= 0.4) : ease(range(progress, 0.25, 0.62));
  const curtains = reducedMotion.matches ? Number(progress >= 0.8) : ease(range(progress, 0.66, 0.94));
  set(section, '--home-left', `${12 + walking * 60}%`);
  set(section, '--home-opacity', reducedMotion.matches ? 1 : range(progress, 0, 0.04) * (1 - range(progress, 0.25, 0.32)));
  set(section, '--bread-left', `${24 + breakfast * 26}%`);
  set(section, '--bread-drop', breakfast);
  set(section, '--bread-angle', `${reducedMotion.matches ? 18 : -342 + breakfast * 360}deg`);
  set(section, '--curtain-close', curtains);
}
function updateClocks(section, progress) {
  const biological = section.querySelector('.biological');
  const work = section.querySelector('.work');
  const rotation = reducedMotion.matches ? 0 : progress;
  set(biological, '--hour-angle', `${270 + rotation * 60}deg`);
  set(biological, '--minute-angle', `${rotation * 180}deg`);
  set(work, '--hour-angle', `${70 + rotation * 160}deg`);
  set(work, '--minute-angle', `${335 + rotation * 480}deg`);
}
const sceneUpdates = [
  (section, p) => updateStoreScene(section, p), updateCharacterScene,
  updateWorkload, updateWorkers, updateFatigue, updateMorning,
  updateClocks, (section, p) => updateStoreScene(section, p, false)
];
function updateTimeline(activeIndex) {
  const time = Number(sections[Math.min(activeIndex, sections.length - 1)].dataset.time);
  timelineLinks.forEach((link, index) => {
    if (index === time) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  });
}
function updateSceneFades(y) {
  let active = 0;
  sectionBounds.forEach(({ top }, index) => {
    if (y >= top - fadeDistance * 0.5) active = index;
  });
  scenes.forEach((scene, index) => {
    const incoming = index === 0 ? 1 : range(y, sectionBounds[index].top - fadeDistance, sectionBounds[index].top);
    const outgoing = index === scenes.length - 1 ? 0 : range(y, sectionBounds[index + 1].top - fadeDistance, sectionBounds[index + 1].top);
    // Ease both ends without a timed CSS transition, which would lag behind scrolling.
    const smooth = value => value * value * (3 - 2 * value);
    const opacity = reducedMotion.matches ? Number(index === active) : smooth(incoming) * (1 - smooth(outgoing));
    set(scene, '--scene-opacity', opacity);
    scene.classList.toggle('is-visible', opacity > 0);
    scene.classList.toggle('is-active', index === active);
    scene.inert = index !== active;
    scene.setAttribute('aria-hidden', String(index !== active));
  });
  updateTimeline(active);
  return active;
}
function updateSectionProgress() {
  const y = window.scrollY;
  sections.forEach((section, index) => {
    const { top, travel } = sectionBounds[index];
    const progress = clamp((y - top) / travel);
    sceneUpdates[index](section, progress);
  });
  const active = updateSceneFades(y);
  if (storySounds) {
    const section = sections[active];
    const bounds = sectionBounds[active];
    storySounds.update(section?.id || 'notes', clamp((y - bounds.top) / bounds.travel), y);
  }
  document.documentElement.classList.add('crossfade-ready');
  framePending = false;
}
function requestUpdate() {
  if (!framePending) { framePending = true; requestAnimationFrame(updateSectionProgress); }
}
window.addEventListener('scroll', requestUpdate, { passive: true });
window.addEventListener('resize', measureSections);
window.addEventListener('load', measureSections);
reducedMotion.addEventListener('change', requestUpdate);
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    // Scroll the invisible scene marker, not its fixed-position artwork.
    const marker = target.closest('.story-section, .notes-section') || target;
    window.scrollTo({ top: marker.offsetTop, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    history.replaceState(null, '', link.getAttribute('href'));
  });
});

// Start on arrival, or on the first gesture when autoplay needs permission.
const soundButton = document.getElementById('sound-toggle');
const soundLabel = document.getElementById('sound-label');
const soundStatus = document.getElementById('sound-status');
const ambient = document.getElementById('background-music');
ambient.volume = 0.2;
let wantsSound = true, startPending = false, retryOnGesture = false;
storySounds = new window.StorySoundEffects({ music: ambient, enabled: () => wantsSound && !ambient.paused });

function syncSoundControl() {
  const playing = !ambient.paused && !ambient.ended;
  soundButton.setAttribute('aria-pressed', String(playing));
  soundButton.setAttribute('aria-label', playing ? 'Mute music and sound effects' : 'Play music and sound effects');
  soundLabel.textContent = playing ? 'Sound On' : 'Sound Off';
  storySounds.refresh();
}

async function startAmbient() {
  if (!wantsSound || startPending) return;
  startPending = true;
  try {
    await ambient.play();
    if (!wantsSound) ambient.pause();
    retryOnGesture = false;
    soundStatus.textContent = '';
  } catch (error) {
    retryOnGesture = wantsSound && error.name === 'NotAllowedError';
    if (wantsSound && error.name !== 'AbortError') {
      soundStatus.textContent = retryOnGesture ? 'Click anywhere to start music.' : 'This sound file couldn’t play.';
    }
  } finally {
    startPending = false;
    syncSoundControl();
  }
}

soundButton.addEventListener('click', () => {
  if (!ambient.paused || startPending) {
    wantsSound = false;
    retryOnGesture = false;
    ambient.pause();
    soundStatus.textContent = '';
    syncSoundControl();
  } else {
    wantsSound = true;
    startAmbient();
  }
});

function retryAmbientOnGesture(event) {
  if (event.target.closest?.('#sound-toggle')) return;
  if (retryOnGesture && wantsSound) startAmbient();
}
document.addEventListener('pointerdown', retryAmbientOnGesture);
document.addEventListener('keydown', retryAmbientOnGesture);
ambient.addEventListener('playing', syncSoundControl);
ambient.addEventListener('pause', syncSoundControl);
syncSoundControl();
startAmbient();
measureSections();
