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

/**
 * @fileoverview
 * @name: Komodo Extension Toolkit / Console
 *
 * @description:
 *
 * Command Output tab console tool
 *
 * CAUTION:
 * Any changes to xtk2 namespace can affect other extensions, so
 * tread softly.
 */

xtk2.console = {
    
    version         : '1.0.0',
    
    S_DEFAULT       : 0,
    S_STRONG        : 1,
    S_OK            : 2,
    S_NOTICE        : 3,
    S_WARNING       : 4,
    S_ERROR         : 5,
    S_DEBUG         : 6,
    S_HINT          : 7,
    S_CUSTOM        : 8,
    
    C_BACKGROUND : 0xFFFFFF,
    C_GUTTER : 0xCCE7F7,
    
    /**
     * Console style definitions
     * @type array [ [RGB Color, Bold, Italic], ... ]
     */
    styles : [
        [0x000000, 0, 0], [0x000000, 1, 0], [0x007700, 1, 0], [0x777777, 1, 0],
        [0xFFAA00, 1, 0], [0xCC0000, 1, 0], [0x0055AA, 1, 0], [0xAAAAAA, 0, 0],
        [0x555555, 0, 0], [0xFF5555, 1, 0], [0x55FF55, 0, 0], [0xFFFF55, 0, 0],
        [0x5555FF, 0, 0], [0xFF55FF, 0, 0], [0x55FFFF, 0, 0], [0x000000, 1, 0]
    ],
    /**
     * @type Document
     */
    document : null,
    /**
     * Command Output scintilla editor object
     * @type Components.interfaces.ISciMoz
     */
    scimoz : null,
    /**
     * Newline sequence used: CRLF, LF or CL
     * @type string
     */
    NL : null,
    
    /**
     * Initializes scimoz object and defines basic "terminal" styles
     */
    init : function() {
        this.document = xtk2.main.document;
        var self = this, i, runoutputScintilla, runoutputContentDocument;
        runoutputScintilla = this.document.getElementById('runoutput-scintilla'); // Komodo 6 style
        if (!runoutputScintilla) { // Komodo 7 style
            runoutputContentDocument = this.document.getElementById("runoutput-desc-tabpanel").contentDocument;
            runoutputScintilla = runoutputContentDocument.getElementById("runoutput-scintilla");
        }
        var BGR = function(RGB) {
            return ((RGB & 0xff0000) >> 0x10) +
                    (RGB & 0x00ff00) +
                    ((RGB & 0x0000ff) << 0x10);
        };
        this.scimoz = runoutputScintilla.scimoz;
        this.NL = ["\r\n", "\n", "\r"][this.scimoz.eOLMode];
        this.scimoz.lexer = 0; // no lexer please, it's a humble terminal thingie
        this.scimoz.styleBits = 8; // for moar styles
        this.scimoz.caretLineVisible = false;
        this.scimoz.caretStyle = 2;
        this.scimoz.caretFore = BGR(0xff8800);
        this.scimoz.caretPeriod = 100;
        this.scimoz.styleSetBack(this.scimoz.STYLE_DEFAULT, BGR(this.C_BACKGROUND)); // to prevent...
        this.scimoz.styleSetBack(this.scimoz.STYLE_LINENUMBER, BGR(this.C_GUTTER)); // colors from user's scheme
        for (i in this.styles) if (this.styles.hasOwnProperty(i)) { // apply styles from config
            this.scimoz.styleSetFore(i, BGR(this.styles[i][0]));
            this.scimoz.styleSetBack(i, this.C_BACKGROUND);
            this.scimoz.styleSetBold(i, !!this.styles[i][1]);
            this.scimoz.styleSetItalic(i, !!this.styles[i][2]);
        }
        // Following line fixes one very evil Komodo 6.x conflict, don't ask:
        addEventListener('unload', function() { self.scimoz = null; }, false);
    },
    
    /**
     * Pops up Command Output tab
     */
    popup : function() {
        ko.run.output.show(window, false);
        var deckWidget = this.document.getElementById('runoutput-deck');
        if (!deckWidget)
            deckWidget = this.document.getElementById("workspace_bottom_area");
        if (deckWidget.selectedIndex !== 0)
            ko.run.output.toggleView();
    },
    
    /**
     * Clears Command Output tab content
     */
    clear : function() {
        if (!this.scimoz) this.init();
        var ro = this.scimoz.readOnly;
        this.scimoz.readOnly = false;
        this.scimoz.clearAll();
        this.scimoz.readOnly = ro;
    },
    
    /**
     * Writes styled text to Command Output tab
     * @param {string} text
     * @param {number} style (optional, defaults to 0)
     */
    write : function(text, style) {
        if (!this.scimoz) this.init();
        var start = this.scimoz.length;
        var ro = this.scimoz.readOnly;
        this.scimoz.readOnly = false;
        this.scimoz.appendText(ko.stringutils.bytelength(text), text);
        if (typeof style !== 'undefined') {
            this.scimoz.startStyling(start, 0xFFFF);
            this.scimoz.setStyling(text.length, style);
        }
        this.scimoz.readOnly = ro;
        this.scimoz.gotoPos(start + 1);
    },
    
    /**
     * Writes styled text to Command Output tab, with newline
     * @param {string} text
     * @param {number} style (optional, defaults to 0)
     */    
    writeln : function(text, style) {
        if (!this.scimoz) this.init();
        if (text) this.write(text, style);
        this.write(this.NL);
    },
    
    /**
     * Displays simple debug information for exception caught
     * @param {Error} exception 
     */
    error : function(exception) {
        this.popup();
        this.write('ERROR: ', this.S_ERROR);
        this.write(exception.message + ' ', this.S_STRONG);
        this.writeln('in line ' +
                                 exception.lineNumber +
                                 ' of ' +
                                 exception.fileName + '.');
    }
};