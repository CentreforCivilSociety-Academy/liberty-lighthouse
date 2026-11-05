/**
 * Editor's Handbook and video guide links
 *
 * Puts the Editor's Handbook (/admin/handbook/) and the video guides
 * (/admin/videos/) one click away:
 * 1. "Handbook" and "Videos" items in the CMS top bar, after Contents and Media
 * 2. Links to both under the Login button on the sign-in page
 *
 * Decap has no setting for extra header links, so this watches the page and
 * adds them whenever Decap draws (or redraws) the header or sign-in page.
 * Every link opens in a new tab so the editor keeps their place.
 */

(function () {
  'use strict';

  var HANDBOOK = '/admin/handbook/';
  var VIDEOS = '/admin/videos/';
  var BOOK_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
    '<path d="M6.5 3A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21H19a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H6.5Z' +
    'M6 18.5c0-.28.22-.5.5-.5H18v1H6.5a.5.5 0 0 1-.5-.5ZM8 6h8v2H8V6Z"></path></svg>';
  var PLAY_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
    '<path d="M5 4h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm5 4.5v7l6-3.5-6-3.5Z"></path></svg>';

  function headerItem(media, href, label, icon, title) {
    var link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = title;
    // Borrow the Media button's look so the items match their neighbours.
    link.className = media.className;
    link.style.textDecoration = 'none';
    var wrapper = media.querySelector('span');
    link.innerHTML = '<span class="' + (wrapper ? wrapper.className : '') + '">' + icon + '</span>' + label;
    var item = document.createElement('li');
    item.setAttribute('data-handbook', '');
    item.appendChild(link);
    return item;
  }

  function addHeaderLink() {
    var list = document.querySelector('header nav ul');
    if (!list || list.querySelector('[data-handbook]')) return;
    var media = list.querySelector('li:last-child > button, li:last-child > a');
    if (!media) return;
    list.appendChild(headerItem(media, HANDBOOK, 'Handbook', BOOK_ICON, "Open the Editor's Handbook in a new tab"));
    list.appendChild(headerItem(media, VIDEOS, 'Videos', PLAY_ICON, 'Open the video guides in a new tab'));
  }

  function addLoginLink() {
    var page = document.querySelector('section[class*="AuthenticationPage"]');
    if (!page || page.querySelector('[data-handbook]')) return;

    var line = document.createElement('p');
    line.setAttribute('data-handbook', '');
    line.style.cssText = 'margin-top:20px;font-size:14px;color:#5c6470;text-align:center;';
    line.appendChild(document.createTextNode('New here? '));
    line.appendChild(loginLink(HANDBOOK, "Read the Editor's Handbook"));
    line.appendChild(document.createTextNode(' or '));
    line.appendChild(loginLink(VIDEOS, 'watch the video guides'));
    page.appendChild(line);
  }

  function loginLink(href, text) {
    var link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = text;
    link.style.cssText = 'color:#3a69c7;text-decoration:underline;';
    return link;
  }

  function update() {
    addHeaderLink();
    addLoginLink();
  }

  new MutationObserver(update).observe(document.body, { childList: true, subtree: true });
  update();
})();
