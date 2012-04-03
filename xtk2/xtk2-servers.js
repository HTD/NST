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

xtk2.servers = { version : '1.0.0' };

/**
 * @fileoverview
 * @name: Komodo Extension Toolkit / Servers
 *
 * @description:
 *
 * This library provides Komodo Servers helpers
 *
 * CAUTION:
 * Any changes to xtk2 namespace can affect other extensions, so
 * tread softly.
 */

/**
 * Retrieves Server Info List
 * @returns {object}
 */
xtk2.servers.get = function() {
    var list = [], data = {}; // required by Komodo interface
    list = // this function will fail silently if changed, don't touch
        ko.services.rConnect.getServerInfoList(data);
    return list;
};

/**
 * Creates remoteServer object from specified alias name
 * @param {string} alias
 * @constructor
 */
xtk2.servers.remoteServer = function(alias) {
    /** @type string **/
    this.protocol = null;
    /** @type string **/
    this.alias = null;
    /** @type string **/
    this.hostname = null;
    /** @type string **/
    this.port = null;
    /** @type string **/
    this.path = null;
    /** @type string **/
    this.username = null;
    /** @type string **/
    this.password = null;
    /** @type boolean **/
    this.configured = false;
    /** @type number **/
    this.timeout = null;
    /** @type Components.interfaces.koIRemoteConnection **/
    this.connection = null;
    
    /**
     * Establishes a remote connection with configured server
     * Sets this.configured to false on error
     * @param {boolean} reset
     * @returns {boolean}
     */
    this.connect = function(reset) {
        if (this.configured && (!this.connection || reset)) try {
            this.connection =
                ko.services.rConnect.getConnectionUsingServerAlias(this.alias);
        } catch (e) { this.configured = false; return false; }
        return true;
    };
    
    /**
     * Loads server info from configuration
     * "*" characters before aliases are ignored
     * @param {string} alias
     * @constructor
     */
    this.init = function(alias, connect) {
        if (alias) {
            var i, j, list = xtk2.servers.get();
            for (i in list) if (list[i].alias.replace(/^\*+/, '') === alias) {
                for (j in list[i])
                    if (this.hasOwnProperty(j) && typeof list[i][j] !== 'function')
                        this[j] = list[i][j];
                if (this.protocol &&
                        this.hostname &&
                        this.username) this.configured = true;
                break;
            }
            if (connect) this.connect();
        }
    };
    
    /**
     * Creates directories required by given path
     * @param {string} path WITHOUT FILE NAME!
     * @returns {number} created directories count
     */
    this.createPath = function(path) {
        var
            a = path.split('/'), // path array
            b = [], // b-array (sequence of paths to create)
            i, // dir index
            s = '', // string subpath
            dirs = 0; // created directories count
        try {
            if (!this.connection) this.connect(true);
            this.connection.changeDirectory(this.path);
            if (path) for (i in a) if (a.hasOwnProperty(i)) {
                b.push(a[i]);
                s = b.join('/');
                // fail silently if dirs exist
                try {
                    this.connection.createDirectory(s, parseInt('750', 8));
                    dirs++;                    
                } catch (xi) {
                    // fail immediately if unexpected error
                    if (this.connection.lastError !== 'Failure') break;
                }
            }
            return dirs;
        } catch(x) { return false; }
    };
    
    /**
     * Creates generic URI from current configuration and remote path
     * @param {string} remotePath
     */
    this.getURI = function(remotePath) {
        var uri = '';
        if (this.protocol) uri+= this.protocol.toLowerCase() + '://';
        if (this.username) uri+= encodeURIComponent(this.username);
        if (this.username && this.password)
            uri+= ':' + encodeURIComponent(this.password);
        if (this.protocol && this.username) uri+= '@';
        if (this.hostname) uri+= this.hostname; else uri+= 'localhost';
        if (this.port > 0) uri+= ':' + this.port;
        if (remotePath) uri+= remotePath.replace(/ /g, '%20');
        return uri;
    };
    
    this.init(alias);        
};