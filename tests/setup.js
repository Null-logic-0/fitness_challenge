// Shared jsdom polyfills — jsdom doesn't implement these, but several
// scripts under test use them.

// <dialog> (admin.js's create/edit/delete modals): jsdom's showModal/close
// support is unreliable across versions, so give deterministic behavior.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.open = false;
  };
}

// IntersectionObserver (leaderboard.js's infinite scroll): not implemented
// in jsdom at all. Exposes `.instances` so a test can grab the most recent
// observer and manually invoke its callback to simulate a scroll-into-view.
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
MockIntersectionObserver.instances = [];
globalThis.IntersectionObserver = MockIntersectionObserver;

// navigator.clipboard (share.js's copyText): not implemented in jsdom.
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => {} },
    configurable: true,
  });
}

// HTMLFormElement named access, e.g. `form.email` for <input name="email">:
// part of the HTML spec and works in every real browser, but jsdom only
// implements the `form.elements.email` form. auth-form.js/settings.js/
// submission.js rely on the spec shorthand, so patch it in for any <form>
// parsed via innerHTML (how these tests build their fixtures).
const innerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
Object.defineProperty(Element.prototype, 'innerHTML', {
  configurable: true,
  enumerable: innerHTMLDescriptor.enumerable,
  get: innerHTMLDescriptor.get,
  set(value) {
    innerHTMLDescriptor.set.call(this, value);
    this.querySelectorAll?.('form').forEach((form) => {
      Array.from(form.elements).forEach((el) => {
        if (el.name && !(el.name in form)) {
          Object.defineProperty(form, el.name, { configurable: true, get: () => form.elements[el.name] });
        }
      });
    });
  },
});
