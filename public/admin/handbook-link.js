/**
 * Editor's Handbook link
 *
 * Puts the Editor's Handbook (served from /admin/handbook/) one click away:
 * 1. A "Handbook" item in the CMS top bar, next to Contents and Media
 * 2. An "Editor's Handbook" link under the Login button on the sign-in page
 *
 * Decap has no setting for extra header links, so this watches the page and
 * adds them whenever Decap draws (or redraws) the header or sign-in page.
 * Both open the handbook in a new tab so the editor keeps their place.
 */

(function () {
  'use strict';

  var HANDBOOK = '/admin/handbook/';
  var BOOK_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
    '<path d="M6.5 3A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21H19a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H6.5Z' +
    'M6 18.5c0-.28.22-.5.5-.5H18v1H6.5a.5.5 0 0 1-.5-.5ZM8 6h8v2H8V6Z"></path></svg>';

  function addHeaderLink() {
    var list = document.querySelector('header nav ul');
    if (!list || list.querySelector('[data-handbook]')) return;
    var media = list.querySelector('li:last-child > button, li:last-child > a');
    if (!media) return;

    var link = document.createElement('a');
    link.href = HANDBOOK;
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = "Open the Editor's Handbook in a new tab";
    // Borrow the Media button's look so the item matches its neighbours.
    link.className = media.className;
    link.style.textDecoration = 'none';
    var icon = media.querySelector('span');
    link.innerHTML =
      '<span class="' + (icon ? icon.className : '') + '">' + BOOK_ICON + '</span>Handbook';

    var item = document.createElement('li');
    item.setAttribute('data-handbook', '');
    item.appendChild(link);
    list.appendChild(item);
  }

  function addLoginLink() {
    var page = document.querySelector('section[class*="AuthenticationPage"]');
    if (!page || page.querySelector('[data-handbook]')) return;

    var link = document.createElement('a');
    link.setAttribute('data-handbook', '');
    link.href = HANDBOOK;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = "New here? Read the Editor's Handbook";
    link.style.cssText =
      'display:block;margin-top:20px;font-size:14px;color:#3a69c7;text-decoration:underline;';
    page.appendChild(link);
  }

  function update() {
    addHeaderLink();
    addLoginLink();
  }

  new MutationObserver(update).observe(document.body, { childList: true, subtree: true });
  update();
})();
