// Copyright 2010 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview HTML5 based history implementation, compatible with
 * goog.History.
 *
 * TODO(user): There should really be a history interface and multiple
 * implementations.
 *
 */


goog.provide('goog.history.Html5History');

goog.require('goog.asserts');
goog.require('goog.events');
goog.require('goog.events.EventTarget');
goog.require('goog.events.EventType');
goog.require('goog.history.Event');
goog.require('goog.history.EventType');



/**
 * An implementation compatible with goog.History that uses the HTML5
 * history APIs.
 *
 * @param {Window=} opt_win The window to listen/dispatch history events on.
 * @constructor
 * @extends {goog.events.EventTarget}
 */
goog.history.Html5History = function(opt_win) {
  goog.events.EventTarget.call(this);
  goog.asserts.assert(goog.history.Html5History.isSupported(opt_win),
      'HTML5 history is not supported.');

  /**
   * The window object to use for history tokens.  Typically the top window.
   * @type {Window}
   * @private
   */
  this.window_ = opt_win || window;

  goog.events.listen(this.window_, goog.events.EventType.POPSTATE,
      this.onHistoryEvent_, false, this);
  goog.events.listen(this.window_, goog.events.EventType.HASHCHANGE,
      this.onHistoryEvent_, false, this);
};
goog.inherits(goog.history.Html5History, goog.events.EventTarget);


/**
 * Returns whether Html5History is supported.
 * @param {Window=} opt_win Optional window to check.
 * @return {boolean} Whether html5 history is supported.
 */
goog.history.Html5History.isSupported = function(opt_win) {
  var win = opt_win || window;
  return !!(win.history && win.history.pushState);
};


/**
 * Status of when the object is active and dispatching events.
 * @type {boolean}
 * @private
 */
goog.history.Html5History.prototype.enabled_ = false;


/**
 * Whether to use the fragment to store the token, defaults to true.
 * @type {boolean}
 * @private
 */
goog.history.Html5History.prototype.useFragment_ = true;


/**
 * If useFragment is false the path will be used, the path prefix will be
 * prepended to all tokens.
 * @type {string}
 * @private
 */
goog.history.Html5History.prototype.pathPrefix_ = '';


/**
 * Starts or stops the History.  When enabled, the History object
 * will immediately fire an event for the current location. The caller can set
 * up event listeners between the call to the constructor and the call to
 * setEnabled.
 *
 * @param {boolean} enable Whether to enable history.
 */
goog.history.Html5History.prototype.setEnabled = function(enable) {
  if (enable == this.enabled_) {
    return;
  }

  this.enabled_ = enable;

  if (enable) {
    this.dispatchEvent(new goog.history.Event(this.getToken(), false));
  }
};


/**
 * Returns the current token.
 * @return {string} The current token.
 */
goog.history.Html5History.prototype.getToken = function() {
  if (this.useFragment_) {
    var loc = this.window_.location.href;
    var index = loc.indexOf('#');
    return index < 0 ? '' : loc.substring(index + 1);
  } else {
    return this.window_.location.pathname.substring(this.pathPrefix_.length);
  }
};


/**
 * Sets the history state.
 * @param {string} token The history state identifier.
 * @param {string=} opt_title Optional title to associate with history entry.
 */
goog.history.Html5History.prototype.setToken = function(token, opt_title) {
  if (token == this.getToken()) {
    return;
  }

  // Per externs/gecko_dom.js document.title can be null.
  this.window_.history.pushState(null,
      opt_title || this.window_.document.title || '', this.getUrl_(token));
  this.dispatchEvent(new goog.history.Event(token, false));
};


/**
 * Replaces the current history state without affecting the rest of the history
 * stack.
 * @param {string} token The history state identifier.
 * @param {string=} opt_title Optional title to associate with history entry.
 */
goog.history.Html5History.prototype.replaceToken = function(token, opt_title) {
  // Per externs/gecko_dom.js document.title can be null.
  this.window_.history.replaceState(null,
      opt_title || this.window_.document.title || '', this.getUrl_(token));
  this.dispatchEvent(new goog.history.Event(token, false));
};


/** @inheritDoc */
goog.history.Html5History.prototype.disposeInternal = function() {
  goog.events.unlisten(this.window_, goog.events.EventType.POPSTATE,
      this.onHistoryEvent_, false, this);
  if (this.useFragment_) {
    goog.events.unlisten(this.window_, goog.events.EventType.HASHCHANGE,
        this.onHistoryEvent_, false, this);
  }
};


/**
 * Sets whether to use the fragment to store tokens.
 * @param {boolean} useFragment Whether to use the fragment.
 */
goog.history.Html5History.prototype.setUseFragment = function(useFragment) {
  if (this.useFragment_ != useFragment) {
    if (useFragment) {
      goog.events.listen(this.window_, goog.events.EventType.HASHCHANGE,
          this.onHistoryEvent_, false, this);
    } else {
      goog.events.unlisten(this.window_, goog.events.EventType.HASHCHANGE,
          this.onHistoryEvent_, false, this);
    }
    this.useFragment_ = useFragment;
  }
};


/**
 * Sets the path prefix to use if storing tokens in the path.
 * @param {string} pathPrefix Sets the path prefix.
 */
goog.history.Html5History.prototype.setPathPrefix = function(pathPrefix) {
  this.pathPrefix_ = pathPrefix;
};


/**
 * Gets the path prefix.
 * @return {string} The path prefix.
 */
goog.history.Html5History.prototype.getPathPrefix = function() {
  return this.pathPrefix_;
};


/**
 * Gets the URL to set when calling history.pushState
 * @param {string} token The history token.
 * @return {string} The URL.
 * @private
 */
goog.history.Html5History.prototype.getUrl_ = function(token) {
  if (this.useFragment_) {
    return '#' + token;
  } else {
    // Paths need to be absolute to maintain correct nesting, so we prepend the
    // known path prefix.  We also preserve the query string, since this is
    // usually what is intended.
    return this.pathPrefix_ + token + this.window_.location.search;
  }
};


/**
 * Handles history events dispatched by the browser.
 * @param {goog.events.BrowserEvent} e The browser event object.
 * @private
 */
goog.history.Html5History.prototype.onHistoryEvent_ = function(e) {
  if (this.enabled_) {
    this.dispatchEvent(new goog.history.Event(this.getToken(), true));
  }
};
