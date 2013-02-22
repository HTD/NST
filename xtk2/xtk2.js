/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 * 
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is Komodo code.
 * 
 * The Initial Developer of the Original Code is ActiveState Software Inc.
 * Portions created by ActiveState Software Inc are Copyright (C) 2000-2007
 * ActiveState Software Inc. All Rights Reserved.
 * 
 * Contributor(s):
 *   ActiveState Software Inc
 *   Shane Caraveo <shanec@activestate.com>
 *   Adam Lyskawa <machine@nisza.org>
 * 
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * 
 * ***** END LICENSE BLOCK ***** */

var xtk2 = { codename : 'Harry', version : '1.0' };

/**
 * @fileoverview:
 * @name: Komodo Extension Toolkit
 * 
 * @description:
 *
 * This is the new xtk library version proposition
 * It's main goal is to develop xtk itself
 * providing compatibility with new Komodo versions
 * and to make extensions using it more maintainable
 *
 * CAUTION:
 * Any changes to xtk2 namespace can affect other extensions, so
 * tread softly.
 */

/**
 * Namespace for main window and document object
 * In Komodo 7 an extension can be run in iframe context
 * All references to main document via window.document
 * will fail when made form Komodo 7 iframe extension context
 * You can use following shortcuts for brevity and compatibility
 */
xtk2.main = { version : '1.0' };
/**
 * Main window
 * @type Window
 */
xtk2.main.window = window.parent ? window.parent : window;
/**
 * Main document
 * @type Document
 */
xtk2.main.document = xtk2.main.window.document;

/**
 * Gets a reference to an XPCOM service
 * @param {String} cName Components.classes string
 * @param {String} ifaceName Components.interfaces name as a string
 * @returns reference to service
 */
xtk2._xs = function(cName, iName) {
    return Components.classes[cName].getService(Components.interfaces[iName]);        
};

/**
 * Creates an XPCOM instance
 * @param {String} cName Components.classes string
 * @param {String} ifaceName Components.interfaces name as a string
 * @returns reference to instance
 */
xtk2._xi = function(cName, iName) {
    return Components.classes[cName].createInstance(Components.interfaces[iName]);
};

/**
 * Queries an XPCOM reference for an interface
 * @param {Object} cName reference to XPCOM object
 * @param {long} iface Components.interfaces element
 * @returns reference to instance with the specified interface
 */
xtk2._qi = function (obj, iface) {
    return obj.QueryInterface(iface);
};

/**
 * Loads a JavaScript file into the global or a defined namespace
 * @param {String} uri uri to a JavaScript File
 * @param {Object} obj object to load the JavaScript into, if undefined loads into global namespace
 */
xtk2.load = function(uri, obj) {
    const loader = xtk2._xs("@mozilla.org/moz/jssubscript-loader;1", "mozIJSSubScriptLoader");
    loader.loadSubScript(uri, obj);
};

/**
 * Namespace exposing some internal services with their interfaces
 */
xtk2.services = { version : '1.0' };

/**
 * OS Service shortcut
 * @type Components.interfaces.koIOs
 */
xtk2.services.os =
    xtk2._xs('@activestate.com/koOs;1', Components.interfaces.koIOs);

/**
 * File Service shortcut
 * @type Components.interfaces.koIFileEx
 */
xtk2.services.file =
    xtk2._xi('@activestate.com/koFileEx;1', Components.interfaces.koIFileEx);
    
/**
 * Preferences Service shortcut
 * @type Components.interfaces.koIPrefService
 */
xtk2.services.prefs =
    xtk2._xs('@activestate.com/koPrefService;1', Components.interfaces.koIPrefService);
    
/**
 * Remote Connect Service shortcut
 * @type Components.interfaces.koIRemoteConnectionService
 */
xtk2.services.rConnect =
    xtk2._xs('@activestate.com/koRemoteConnectionService;1', Components.interfaces.koIRemoteConnectionService);
    
/**
 * Document Service shortcut
 * @type Components.interfaces.koIDocumentService
 */
xtk2.services.doc =
    xtk2._xs('@activestate.com/koDocumentService;1', Components.interfaces.koIDocumentService);
    
/**
 * Observer Service shortcut
 * @type Components.interfaces.nsIObserverService
 */
xtk2.services.observer =
    xtk2._xs('@mozilla.org/observer-service;1', Components.interfaces.nsIObserverService);
    
/**
 * System Utilities Service shortcut
 * @type Components.interfaces.koISysUtils
 */
xtk2.services.sys =
    xtk2._xs('@activestate.com/koSysUtils;1', Components.interfaces.koISysUtils);

/**
 * Komodo event handling namespace
 */
xtk2.events = { version : '1.0' };

/**
 * An array of common used window events
 * triggered by Komodo itself
 * @type array
 */
xtk2.events._koWindowEvents = [
    'codeintel_activated_window',
    'codeintel_deactivated_window',
    'current_view_changed',
    'current_view_check_status',
    'current_view_encoding_changed',
    'current_view_language_changed',
    'current_view_linecol_changed',
    'load',
    'view_closed',
    'view_list_closed',
    'view_opened',
    'unload'    
];

/**
 * Binds a function to global or MAIN window events
 * @param {array|string} array of event names or events separated with space (jQuery style)
 * @param {function} callback
 */
xtk2.events.bind = function(events, fn) {
    var i, e = xtk2.events._koWindowEvents, observer = xtk2.services.observer;
    events = typeof events === 'string' ? events.split(' ') : events;
    for (i in events) {
        if (e.indexOf(events[i]) < 0) // global events
            observer.addObserver({ observe : fn }, events[i], false);
        else xtk2.main.window.addEventListener(events[i], fn, false); // window events
    }
};

/**
 * Unbinds a function from global or MAIN window events
 * @param {array|string} array of event names or events separated with space (jQuery style)
 * @param {function} callback
 */
xtk2.events.unbind = function(events, fn) {
    var i, e = xtk2.events._koWindowEvents, observer = xtk2.services.observer;
    events = typeof events === 'string' ? events.split(' ') : events;
    for (i in events) {
        if (e.indexOf(events[i]) < 0) // global events
            observer.removeObserver({ observe : fn }, events[i]);
        else xtk2.main.window.removeEventListener(events[i], fn, false); // window events
    }    
};

/**
 * Triggers specified global or MAIN window events
 * @param {string} events
 */
xtk2.events.trigger = function(events) {
    var i, e = xtk2.events._koWindowEvents, observer = xtk2.services.observer;
    events = typeof events === 'string' ? events.split(' ') : events;
    for (i in events) {
        if (e.indexOf(events[i]) < 0) // global events
            observer.notifyObservers(this, events[i], null);
        else {
            var event = xtk2.main.document.createEvent('Events');
            event.initEvent(events[i], true, true);
            xtk2.main.window.dispatchEvent(event); // window events
        }
    }     
};

/**
 * Binds a handler to codeintel_activated_window event or triggers it
 * @param {function} fn
 */
xtk2.events.codeintel_activated_window = function(fn) {
    const e = 'codeintel_activated_window';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to codeintel_deactivated_window event or triggers it
 * @param {function} fn
 */
xtk2.events.codeintel_deactivated_window = function(fn) {
    const e = 'codeintel_deactivated_window';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to current_project_changed event or triggers it
 * @param {function} fn
 */
xtk2.events.current_project_changed = function(fn) {
    const e = 'current_project_changed';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to current_view_changed event or triggers it
 * @param {function} fn
 */
xtk2.events.current_view_changed = function(fn) {
    const e = 'current_view_changed';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to current_view_changed_status or triggers it
 * @param {function} fn
 */
xtk2.events.current_view_changed_status = function(fn) {
    const e = 'current_view_changed_status';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to current_view_encoding_changed event or triggers it
 * @param {function} fn
 */
xtk2.events.current_view_encoding_changed = function(fn) {
    const e = 'current_view_encoding_changed';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to current_view_language_changed event or triggers it
 * @param {function} fn
 */
xtk2.events.current_view_language_changed = function(fn) {
    const e = 'current_view_language_changed';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to current_view_linecol_changed event or triggers it
 * @param {function} fn
 */
xtk2.events.current_view_linecol_changed = function(fn) {
    const e = 'current_view_linecol_changed';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to file_changed event or triggers it
 * @param {function} fn
 */
xtk2.events.file_changed = function(fn) {
    const e = 'file_changed';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to komodo-ui-started event or triggers it
 * @param {function} fn
 */
xtk2.events.komodo_ui_started = function(fn, delay) {
    const e = 'komodo-ui-started';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else {
        if (typeof delay === 'undefined')
            xtk2.events.bind(e, fn);
        else
            xtk2.events.bind(e, function() {
                setTimeout(fn, delay);
            });
    }   
};

/**
 * Binds a handler to a delayed komodo-ui-started event
 * @param {function} fn
 * @param {number} delay in milliseconds, default 500
 */
xtk2.events.komodo_ui_started_delayed = function(fn, delay) {
    if (typeof delay === 'undefined') delay = 500;
    xtk2.events.bind('komodo-ui-started', function() {
        setTimeout(fn, delay);
    });
};

/**
 * Binds a handler to load event or triggers it
 * @param {function} fn
 * @param {number} delay in milliseconds
 */
xtk2.events.load = function(fn, delay) {
    const e = 'load';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else {
        if (typeof delay === 'undefined')
            xtk2.events.bind(e, fn);
        else
            xtk2.events.bind(e, function() {
                setTimeout(fn, delay);
            });
    }
};

/**
 * Binds a handler to view_closed event or triggers it
 * @param {function} fn
 */
xtk2.events.view_closed = function(fn) {
    const e = 'view_closed';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to view_list_closed event or triggers it
 * @param {function} fn
 */
xtk2.events.view_list_closed = function(fn) {
    const e = 'view_list_closed';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to view_opened event or triggers it
 * @param {function} fn
 */
xtk2.events.view_opened = function(fn) {
    const e = 'view_opened';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Binds a handler to unload event or triggers it
 * @param {function} fn
 */
xtk2.events.unload = function(fn) {
    const e = 'unload';
    if (typeof fn === 'undefined') xtk2.events.trigger(e);
    else xtk2.events.bind(e, fn);
};

/**
 * Komodo specific JavaScript tools
 */
xtk2.ko = { version : '1.0' };

/**
 * Returns configured active project directory
 * (from import prefs or activeProjectPath)
 * - since ko.interpolate.currentFileProjectPath() works randomly,
 * this function is solid
 * @returns {string}
 */
xtk2.ko.activeProjectDir = function() {
    if (!ko.projects.manager.currentProject) return null;
    var prefs = ko.projects.manager.currentProject.prefset,
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
xtk2.ko.currentFileDir = function() {
    return ko.interpolate.currentFilePath().replace(/[\/\\][^\/\\]+$/, '');
};

/**
 * Returns true if current file belongs to active project
 * To be called from current_view_changed handler
 * - since ko.interpolate.currentFileProjectPath() works randomly,
 * this function is solid
 * @returns {boolean}
 */
xtk2.ko.isFileInActiveProject = function() {
    return xtk2.ko.currentFileDir()
           .indexOf(xtk2.ko.activeProjectDir()) === 0;
};

/**
 * Formatting tools
 */
xtk2.format = { version : '1.0' };

/**
 * Returns current date and time in ISO8601 format
 * @param {Date} date
 * @param {string} part
 * @returns {string}
 */
xtk2.format.ISOTime = function(date, part) {
    var d = [ // date part
            date.getFullYear().zeroFill(4),
            date.getMonth().zeroFill(2),
            date.getDay().zeroFill(2)
        ].join('-');
    var t = [ // time part
            date.getHours().zeroFill(2),
            date.getMinutes().zeroFill(2),
            date.getSeconds().zeroFill(2)
        ].join(':');
    switch (part) {
        case 'date': return d;
        case 'time': return t;
        default: return d + ' ' + t;
    }
};

/**
 * Returns a number as a zero filled string
 * @param {number} num
 * @param {number} digits
 * @returns {string}
 */
xtk2.format.zeroFill = function(num, digits) {
    var i, s = num.toString(10);
    if (!digits) return s;
    var x = digits - s.length;
    for (i = 0; i < x; i++) s = '0' + s;
    return s;
};

/**
 * Extension debugger module
 */
xtk2.debug = { version : '1.0' };

/**
 * Debugger severity options
 */
xtk2.debug.severity = {
    INFO    : 0,
    WARNING : 1,
    ERROR   : 2
};

/**
 * Outputs a message to user with one of available methods:
 * notifications / alert / log
 * @param {string} message text to display
 * @param {string} details aditional details
 * @param {array} tags string tags to mark notification sender
 * @param {number} severity one of xtk2.debug.severity values
 */
xtk2.debug._output = function(message, details, tags, severity) {
    if (tags == null) tags = ['xtk2', 'debug'];
    else if (typeof tags === 'string') tags = tags.split(' ');
    if (severity == null) severity = 0;
    if (ko.notifications && xtk2.debug._output.preference === 'notifications') {
        ko.notifications.add(
            message,
            tags,
            'xtk2_debug_' + Math.random(),
            typeof details !== 'undefined'
                ? { severity : severity, description : details }
                : { severity : severity }
        );
    } else {
        var i, t = '', l = '', s = '';
        for (i = 0; i < 78; i++) l+= '-'; l+= '\n';
        t  = message + ' [' + tags.join(' ') + ']\n' + l;
        if (details) t+= details;
        if (xtk2.debug._output.preference === 'alert') {
            switch (severity) {
                case xtk2.debug.severity.INFO: s = 'EXTENSION INFO'; break;
                case xtk2.debug.severity.WARNING: s = 'EXTENSION WARNING'; break;
                case xtk2.debug.severity.ERROR: s = 'EXTENSION ERROR'; break;
            }
            ko.dialogs.alert(s, t);
        } else {
            var log = ko.logging.getLogger('xtk2.logger');
            log.setLevel(1);
            t = '\n' + l + t;
            switch (severity) {
                case xtk2.debug.severity.INFO: log.info(t); break;
                case xtk2.debug.severity.WARNING: log.warn(t); break;
                case xtk2.debug.severity.ERROR: log.error(t); break;
            }
        }
    }
};

/**
 * 'notifications' / 'alert' / 'log'
 * @type string
 */
xtk2.debug._output.preference = 'notifications';

/**
 * Displays object data debug
 * @param {string} message
 * @param {object} data
 * @param {array|string} tags
 */
xtk2.debug.data = function(message, data, tags) {
    xtk2.debug._output(
        message,
        ko.logging.getObjectTree(data, 1),
        tags,
        this.severity.INFO
    );
};

/**
 * Displays debug info
 * @param {string} message
 * @param {string} details
 * @param {array|string} tags
 */
xtk2.debug.info = function(message, details, tags) {
    xtk2.debug._output(
        message,
        details,
        tags,
        this.severity.INFO
    );
};

/**
 * Displays debug warning
 * @param {string} message
 * @param {string} details
 * @param {array|string} tags
 */
xtk2.debug.warning = function(message, details, tags) {
    xtk2.debug._output(
        message,
        details,
        tags,
        this.severity.WARNING
    );
};

/**
 * Displays debug error
 * @param {string} message
 * @param {string} details
 * @param {array|string} tags
 */
xtk2.debug.error = function(message, details, tags) {
    xtk2.debug._output(
        message,
        details,
        tags,
        this.severity.ERROR
    );
};

/**
 * Displays an exception with a stack trace
 * @param {Error} exception
 * @param {array|string} tags
 */
xtk2.debug.exceptionHandler = function(exception, tags) {
    xtk2.debug._output(
        'EXCEPTION',
        exception.message + ' ' +
        '\nin line ' + exception.lineNumber + ' ' +
        '\nof ' + exception.fileName + ' ' +
        '\n\nSTACK TRACE:\n\n' + ko.logging.getStack(1),
        tags,
        this.severity.ERROR
    );
};