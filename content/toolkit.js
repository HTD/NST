/**
 * Komodo Extension Toolkit
 *
 * @fileoverview
 *
 * Super duper toolkit for writing Komodo extensions
 * FAST, CLEAN AND READABLE
 *
 * WARNING: this file contains shared code,
 * changes can break extensions which depend on it
 * 
 * @version 1.1
 * @author Adam Łyskawa
 *
 * Copyright (c) 2010, Adam Łyskawa 
 * All rights reserved. 
 * 
 * Redistribution and use in source and binary forms, with or without 
 * modification, are permitted provided that the following conditions are met: 
 * 
 * Redistributions of source code must retain the above copyright notice, 
 * this list of conditions and the following disclaimer. 
 * Redistributions in binary form must reproduce the above copyright 
 * notice, this list of conditions and the following disclaimer in the 
 * documentation and/or other materials provided with the distribution. 
 * Neither the name of  nor the names of its contributors may be used to 
 * endorse or promote products derived from this software without specific 
 * prior written permission. 

 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" 
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE 
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE 
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE 
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR 
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF 
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS 
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN 
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE 
 * POSSIBILITY OF SUCH DAMAGE. 
 */

if (typeof(toolkit) == 'undefined' || toolkit.version < '1.1') {
  
  toolkit = { version : '1.1' };

  if (typeof(ko.services) == 'undefined')  ko.services = {};
    
  /**
   * OS Service shortcut
   */
  ko.services.os =
    Components
    .classes["@activestate.com/koOs;1"]
    .getService(Components.interfaces.koIOs);
  /**
   * Preferences Service shortcut
   */
  ko.services.prefs =
    Components
    .classes["@activestate.com/koPrefService;1"]
    .getService(Components.interfaces.koIPrefService);
  /**
   * Remote Connect Service shortcut
   */
  ko.services.rConnect =
    Components
    .classes["@activestate.com/koRemoteConnectionService;1"]
    .getService(Components.interfaces.koIRemoteConnectionService);
  /**
   * Document Service shortcut
   */
  ko.services.doc =
    Components
    .classes["@activestate.com/koDocumentService;1"]
    .getService(Components.interfaces.koIDocumentService);
  /**
   * Observer Service shortcut
   */
  ko.services.observer =
    Components
    .classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);
  /**
   * System Utilities Service shortcut
   */
  ko.services.sys =
    Components
    .classes['@activestate.com/koSysUtils;1']
    .getService(Components.interfaces.koISysUtils);
  /**
   * Hooks komodo events, to make life easier and code with style
   * Inspired with DRY rule and Ockham's Razor
   * To be updated to match further Komodo versions
   * @param {string} events separated with space (jQuery style)
   * @param {function} callback
   */
  hook = function(events, callback) {
    var windowEvents = ['codeintel_activated_window',
                        'codeintel_deactivated_window',
                        'current_view_changed',
                        'current_view_check_status',
                        'current_view_encoding_changed',
                        'current_view_language_changed',
                        'current_view_linecol_changed',
                        'load',
                        'view_closed',
                        'view_list_closed',
                        'view_opened'];
    events = typeof(events) == 'string' ? events.split(' ') : events;
    for (var i in events) {
      if (windowEvents.indexOf(events[i]) < 0) // global events
        ko.services.observer.addObserver({ observe : callback }, events[i], false);
      else window.addEventListener(events[i], callback, false); // window events
    }
  };
  /**
   * Converts 24bit number to BGR color value
   * @returns number
   */
  Number.prototype.toBGR = function() {
    return ((this & 0xff0000) >> 0x10) +
            (this & 0x00ff00) +
           ((this & 0x0000ff) << 0x10);
  };
  /**
   * Returns a number as a zero filled string
   * @param {number} digits
   * @returns {string}
   */
  Number.prototype.zeroFill = function(digits) {
    var s = this.toString(10);
    if (!digits) return s;
    var x = digits - s.length;
    for (var i = 0; i < x; i++) s = '0' + s;
    return s;
  };
  /**
   * Returns current date and time in ISO8601 format
   * @param {string} part
   * @returns {string}
   */
  Date.prototype.getISOTime = function(part) {
    var date = [
                this.getFullYear().zeroFill(4),
                this.getMonth().zeroFill(2),
                this.getDay().zeroFill(2)
               ].join('-');
    var time = [
                this.getHours().zeroFill(2),
                this.getMinutes().zeroFill(2),
                this.getSeconds().zeroFill(2)
               ].join(':');
    switch (part) {
      case 'date': return date;
      case 'time': return time;
      default: return [date, time].join(' ');
    }
  };
  /**
   * Returns configured active project directory
   * (from import prefs or activeProjectPath)
   * - since ko.interpolate.currentFileProjectPath() works randomly,
   * this function is solid
   * @returns {string}
   */
  ko.interpolate.activeProjectDir = function() {
    var
      prefs = ko.projects.manager.currentProject.prefset,
      projectFileDir =
        ko.interpolate.activeProjectPath().replace(/[\/\\][^\/\\]+$/, ''),
      liveImportDir = prefs.hasStringPref('import_dirname')
        ? prefs.getStringPref('import_dirname') // read if set...
        : ''; // or set to empty string
      return liveImportDir
        ? (liveImportDir.match(/(^\/|^[A-Z]:)/) // live import configured...
            ? liveImportDir // absolute path case...
            : (projectFileDir + '/' + liveImportDir)) // or relative path case
        : projectFileDir; // or use directory of the project file
  };
  /**
   * Returns current file directory (w/o filename)
   * @returns {string}
   */
  ko.interpolate.currentFileDir = function() {
    return ko.interpolate.currentFilePath().replace(/[\/\\][^\/\\]+$/, '');
  };
  /**
   * Returns true if current file belongs to active project
   * To be called from current_view_changed handler
   * - since ko.interpolate.currentFileProjectPath() works randomly,
   * this function is solid
   * @returns {boolean}
   */
  ko.interpolate.isFileInActiveProject = function() {
    return ko.interpolate.currentFileDir()
            .indexOf(ko.interpolate.activeProjectDir()) === 0;
  }; 
  /**
   * Delayed callback
   * @param {number} ms
   * @param {function} callback
   */
  window.delay = function(ms, callback) {
    var timeoutId = window.setTimeout(function() {
      callback();
      window.clearTimeout(timeoutId);
    }, ms, false);
  };
}