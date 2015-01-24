/**
 * NST (New Source Tree)
 *
 * @fileoverview
 *
 * Code Browser -like extension for Komodo Edit
 *
 * @author Adam Łyskawa
 *
 * Contributors:
 * Sergey Lerg
 * Roberto Bouzout
 * wa03
 * Joel Goguen
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

/**
 * Namespaces
 */
if (typeof ko.extensions === 'undefined') ko.extensions = {};
if (typeof ko.extensions.NST === 'undefined') ko.extensions.NST = { version : '0.62' };

/**
 * Regular expressions quoting (from phpjs.org) used for comments
 * @param {string} str
 * @param {string} delimiter
 */
function preg_quote(str, delimiter) {
  return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' +
                                       (delimiter || '') +
                                       '-]', 'g'), '\\$&');
}

/**
 * Extension code
 */
(function () {
  ///
  /// Common constants
  ///
  const // Rows indices
        TR_TEXT               = 0, // text
        TR_LEVEL              = 1, // tree level
        TR_ID                 = 2, // node index
        TR_OPEN               = 3, // open state
        TR_PARENT             = 4, // parent node index
        // Node types
        TYPE_UNKNOWN          = 0,
        TYPE_CLASS            = 1,
        TYPE_FUNCTION         = 2,
        TYPE_PRIVATE          = 3,
        TYPE_PROTECTED        = 4,
        TYPE_PUBLIC           = 5,
        TYPE_PROTOTYPE        = 6,
        TYPE_PROTOTYPE_CLASS  = 7,
        TYPE_PRIVATE_STATIC   = 8,
        TYPE_PROTECTED_STATIC = 9,
        TYPE_PUBLIC_STATIC    = 10,
        TYPE_JQUERY_EXT       = 11,
        TYPE_TAG              = 12,
        TYPE_STYLE            = 13,
        TYPE_AT_RULE          = 14,
        // Display name
        NAME = 'NST';
  ///
  /// Extension scoped variables
  ///
  var main = this,
      NST = null,
      NSTBox = null,
      NSTView = null,
  /**
   * Node class
   * @param {number} id node index counted from 1 (0 reserved for root)
   * @param {number} parent node index
   * @param {string} text node text
   * @param {number} line code line number pointer
   * @param {number} type number responsible for different icons
   */
  node = function(id, parent, text, line, type, info) {
    this.id = id; // from 1, 0 is reserved for root
    this.parent = parent; // parent index
    this.text = text; // node text
    this.line = line; // code line number pointer
    this.type = type; // node type (used for different node icons only)
    if (typeof(info) != 'undefined') this.info = info;
    /**
     * Checks if the node is a container for other nodes
     * @param {array} nodes
     * @returns {boolean}
     */
    this.hasChildNodesIn = function(nodes) {
      for (var i in nodes) if (nodes[i].parent == this.id) return true;
      return false;
    };
    /**
     * Search the node and all descendant nodes for specified match
     * @param {string|RegExp} match
     * @param {array} nodes in the same nodelist
     * @returns {boolean}
     */
    this.search = function(match, nodes) {
      var i, parents = [ this.id ], found = false,
          mode = (typeof(match) !== 'string') * 1;
      for (i in nodes)
        if (nodes[i] && (parents.indexOf(nodes[i].parent) >= 0)) {
          if (nodes[i].parent) parents.push(nodes[i].id);
          if (
            (
              mode === 0 && // matching text
              nodes[i].text.toLocaleLowerCase().indexOf(match.toLocaleLowerCase()) >= 0
            ) ||
            (
              mode === 1 && // matching regex
              nodes[i].text.match(match)
            )) {
            found = true;
            break;
          }
      }
      return found;
    };
  };
  /**
   * NodeList class (provides basic tree structure helpers)
   */
  nodeList = function() {
    /** @type array data **/
    this.nodes = [];
    /** @type array parent ids stack **/
    this.parents = [0];
    /**
     * Adds a node starting a new nesting level
     * @param {string} text
     * @param {number} line
     * @param {number} type
     * @param {string} info
     */
    this.add = function(text, line, type, info) {
      var id = this.nodes.length + 1;
      this.nodes.push(new node(id,
                               this.parents[this.parents.length - 1],
                               text,
                               line,
                               type,
                               info));
      this.parents.push(this.nodes.length);
      return id;
    };
    /**
     * Ends current or n nesting levels
     * @param {number} n
     */
    this.end = function(n) {
      if (typeof(n) == 'undefined') n = 1;
      for (var i = 0; i < n; i++) this.parents.pop();
    };
    /**
     * Ends all nesting levels
     */
    this.zeroIdentation = function() {
      this.parents = [0];
    };
  };
  /**
   * Common line preprocessor
   * @constructor
   * @param {string} id identifier definition
   * @param {array} lc line comment definitions
   * @param {array} bc block comment begin and end definitions
   * @param {boolean} defBlockParse if definition blocks should be parsed
   */
  Preprocessor = function(id, lc, bc, defBlockParse) {
    if (typeof(defBlockParse) === 'undefined') defBlockParse = false;
    if (defBlockParse) {
      var defGroupRE = defBlockParse === 'Python' // group by this RE
            ? /\s*\\\s*$/
            : /[^\}]\s*,\s*$/,
          idMatchRE = new RegExp('^\\s*' + id); // must start with identifier
    }
    this.blockComment = false; // true if a line is a part of a block comment
    this.blockLiteral1 = false; // true if a line is inside or has '''
    this.blockLiteral2 = false; // true if a line is inside or has """
    this.literals = []; // current line's stripped literals
    this.defBlock = ''; // current definition block
    this.defBlockStart = -1; // current definition block first line
    this.defBlockReady = false; // matching of current definition block done
    /**
     * Defaults
     */
    if (typeof(lc) == 'undefined') lc = ['//'];
    if (typeof(bc) == 'undefined') bc = ['/*', '*/'];
    if (lc === null) lc = [];
    if (bc === null) bc = [];
    if (bc.length === 1) bc.push(bc[0]);
    // if end block is the same as start block
    /**
     * Private variables
     */
    var self = this;
        lcre = [], // line comments removal REs
        swc = ['^\\s*(?:']; // starts with comment RE
        bcs = new RegExp(preg_quote(bc[0])); // block comment start RE
    /**
     * Prepares initial state and regular expressions
     */
    var _init = function() {
      if (bc && bc.length) swc.push(preg_quote(bc[0]));
      for (i in lc) {
        swc.push(preg_quote(lc[i]));
        lcre.push(new RegExp('([^$0-9A-z\'"]|^)' + lc[i] + '.*$', 'g'));
      }
      swc = swc[0] + swc.slice(1).join('|') + ')';
    }(); // autostart
    /**
     * Resets current definition block
     */
    this.defBlockReset = function() {
      this.defBlockStart = -1;
      this.defBlock = '';
      this.defBlockReady = false;
    }
    /**
     * Matches definition blocks
     * @param {string} line
     * @param {number} index
     */
    this.defBlockMatch = function(line, index) {
      var m = line.match(defGroupRE) &&
              line.match(idMatchRE);
      // first def. block line must contain '('
      if (this.defBlockStart < 0) m = m && (line.indexOf('(') >= 0);
      if (m) {
        if (this.defBlockStart < 0) {
          this.defBlockStart = index;
          this.defBlock = line.replace(/\s*\\?$/, '');
        } else this.defBlock+= ' ' + line.replace(/^\s*|\s*\\?$/g, '');
        this.defBlockReady = false;
      } else {
        if (this.defBlockStart >= 0) {
          if (this.defBlockReady) this.defBlockReset();
          else {
            this.defBlock+= ' ' + line.replace(/^\s*|\s*\\?$/g, '');
            this.defBlockReady = true;
          }
        }
      }
    }
    /**
     * Performs line preprocessing, stripping literals and removing comments
     * @param {string} line
     * @param {number} index
     * @param {bool} blockLiterals - set true for Python
     * @returns {boolean} true if there is any data in line to process
     */
    this.parse = function(line, index, blockLiterals) {
      if (blockLiterals) { // Python only
        /// these are handled as comments
        for (i in line.match(/'''/g))
          this.blockLiteral1 = !this.blockLiteral1;
        for (i in line.match(/"""/g))
          this.blockLiteral2 = !this.blockLiteral2;
        // if we found an odd number of 1 of these, we have block literal line...
        if (this.blockLiteral1 || this.blockLiteral2) return false; // to ignore
      }
      if (!line.match(swc)) { // if line not starts with comment
        /// strip literals:
        line = line.replace(/\\'/g, String.fromCharCode(0))
                   .replace(/\\"/g, String.fromCharCode(1))
                   .replace(/\\\//g, String.fromCharCode(2)); // strip escapes
        this.literals = [];
        if ((lm = line.match(/'.*?'/g))) this.literals = this.literals.concat(lm);
        if ((lm = line.match(/".*?"/g))) this.literals = this.literals.concat(lm);
        if ((lm = line.match(/\/.+?\//g))) this.literals = this.literals.concat(lm);
        line = line.replace(/'.*?'/g, "'...'")
                   .replace(/".*?"/g, '"..."')
                   .replace(/\/.+?\//g, '/.../'); // remove literals from code
        for (i in this.literals) this.literals[i] =
          this.literals[i].replace(/\x00/g, "\\'")
                     .replace(/\x01/g, '\\"')
                     .replace(/\x02/g, '\\/'); // restore escapes to literals

      }
      if (bc[0] && bc[1]) { // if pair of block comment definitions applicable
        /// block comment start matching
        if (line.indexOf(bc[0]) >= 0) {
          this.blockComment = true;
        }
        /// block comment end matching
        if (this.blockComment && (p = line.indexOf(bc[1])) >= 0) {
          line = line.substring(p + bc[1].length);
          this.blockComment = false;
        }
      }
      if (this.blockComment) return false;
      /// line comment start matching
      for (i in lc) if (line.indexOf(lc[i]) >= 0)
        line = line.replace(lcre[i], '$1');
      line = line.replace(/^\s+$/, '');
      /// defninition blocks matching
      if (defBlockParse) this.defBlockMatch(line, index);
      if (this.defBlock) {
        if (!this.defBlockReady) return false;
        else {
          line = this.defBlock;
          this.defBlock = '';
        }
      }
      return line;
    };
  };
  /**
   * JS-like language line parser
   * Handles JS, PHP, Perl, CSS, ActionScript
   * @param {string} lang detected language name
   * @param {array} classes string class definitions
   * @param {array} functions string function definitions
   * @param {string} id identifier definition RE
   * @param {array} lc line comment delimiters array
   * @param {array} bc block comment delimiters array
   */
  LineParserJS = function(lang, classes, functions, id, lc, bc) {
    /// Defaults for JavaScript
    if (typeof(id) == 'undefined') id = '[a-zA-Z_$][.a-zA-Z0-9_$]*';
    /// Private variables
    var self = this, // this access for private functions
        pp = new Preprocessor(id, lc, bc, lang != 'CSS'), // preprocessor for literals and comments
        i, m; // index, matches
    /// Regular expressions
    var _classes = [], // class matching RE array
        _functions = [], // function matching RE array
        _jQuery_match = /^\s*\$\.|^\s*jQuery\./g; // jQuery matching RE
    /// Public properties
    this.index = -1;
    this.text = null; // node text
    this.type = TYPE_UNKNOWN; // node type
    this.open = true; // if the node is open container for other nodes
    this.level = 0; // code nesting level
    this.nextLevelOffset = 0; // next level offset for \n before brace syntax
    this.nodeLevels = []; // nesting levels for nodes
    this.braceRequired = false; // if opening brace is required to accept node
    this.removeLast = false; // if last node didn't match the brace required
    this.blockComment = false; // block comment mode
    /**
     * Parses class or function definition
     * @param {string} definition
     * @returns {RegExp}
     */
    var _parseDefinition = function(definition) {
      return new RegExp('^\\s*' +
        definition
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*?')
          .replace(/ : /g, '\\s*\\:\\s*')
          .replace(/:type/, '(?:\\s*:\\s*[a-zA-Z\\*]+\\s*)?')
          .replace(/ \}/g, '\\}')
          .replace(/ \{$/g, '(?:\\s*\\{\\s*$|\s*$|\\s*\\{.*?\\}\\s*[,;]?\\s*$)')
          .replace(/ = /g, '\\s*\\=\\s*')
          .replace(/ +/g, '\\s+')
          .replace(/id/g, id)
          .replace(/name/g, '(' + id + ')')
          .replace(/\,$/, '(?:\\s*[,{]\\s*$|\\s*$)') // fixed for CSS
          .replace(/\(\)/g, '\\s*(\\([^}{;]*\\))\\s*'));
    };
    /**
     * Line parser initialization
     */
    var _init = function() {
      /// class definition REs:
      if (classes && classes.length)
        for (i in classes) _classes.push(_parseDefinition(classes[i]));
      /// function definition REs:
      if (functions && functions.length)
        for (i in functions) _functions.push(_parseDefinition(functions[i]));
    }(); // auto started here
    /**
     * Nesting analyzer, TIME CRITICAL
     * @param {string} line
     * @param {boolean} matched
     * @returns {number}
     */
    var updateNesting = function(line) {
      var o, p, lc = 0;
      for (p in line) {
        if (line.charAt(p) == '{') lc++; else
        if (line.charAt(p) == '}') lc--;
      }
      if (self.nextLevelOffset) {
        lc+= self.nextLevelOffset;
        self.nextLevelOffset = 0;
      }
      self.level+= lc;
      if (self.text) {
        self.nodeLevels.push(self.level);
        if (lc < 1) { // no level increase?
          if (line.indexOf('}') >= 0 || line.match(/,$/)) { // closed in the same line or block def?
            o = line.match(/\{(.*?)\}/); // one liners...
            if (o && !o[1] && !self.text.match(/[^a-zA-Z0-9_]/)) { // empty?
              self.nodeLevels.pop();
              self.text = null; // skip small empty nodes with common names
            } else {
              self.nodeLevels.pop();
              self.open = false;
            }
            return;
          } else { // no opening brace then
            if (lang != 'Perl' && !line.match(/\s*:\s*XML\s*[:=]\s*$/)) self.braceRequired = true;
            self.level++; // bump level anyway
            self.nodeLevels[self.nodeLevels.length - 1] = self.level;
            if (lang != 'Perl' || !line.match(/;\s*$/))
              self.nextLevelOffset = -1;
          }
        }
      }
      self.open = self.level >= self.nodeLevels.slice(-1)[0];
      if (!self.open) self.nodeLevels.pop();
    };
    /**
     * Resets line parser (call before each line)
     */
    var reset = function() {
      self.text = null;
      self.open= true;
    };
    /**
     * Single line parsing code, TIME CRITICAL
     * @param {string} line
     */
    this.parse = function(line, index) {
      reset();
      line = pp.parse(line, index); // code filtered, definition blocks matched
      if (!line) return;
      this.index = pp.defBlockReady ? (1 * pp.defBlockStart) : (1 * index);
      this.removeLast = this.braceRequired &&
                        line.replace(/\s+/, '').length &&
                        !line.match(/^\s*\{\s*$/);
      this.braceRequired = false;
      var ln; // literals index
      ///
      /// Matching classes
      ///
      if (_classes.length) for (i in _classes)
        if ((m = _classes[i].exec(line)) && m[1]) {
        this.text = m[1];
        if (pp.literals) for (ln in pp.literals) // literals restore
          this.text = this.text.replace(/['"\/]\.\.\.['"\/]/, pp.literals[ln]);
        if (lang == 'CSS') this.type = TYPE_AT_RULE;
        else {
          this.type = TYPE_CLASS;
          if (lang == 'JavaScript') {
            if (line.match(_jQuery_match)) {
              this.text = this.text.replace(_jQuery_match, '');
              this.type = TYPE_JQUERY_EXT;
            }
            else
            if (line.match(/\bprototype\b/)) this.type = TYPE_PROTOTYPE_CLASS;
          }
        }
        break;
      }
      /// Matching functions
      if (!this.text && // class is not matched
          _functions.length) // not inside started definition block
            for (i in _functions) // match must be done against all definitions
              if ((m = _functions[i].exec(line)) && m[1]) { // if matched:
        this.text = m[1].replace('this.', '');
        if(lang == 'C++') this.text = m[1].replace(/^\*/, '');
        if (m[2]) { // default values will be removed:
          if (lang != 'CSS') m[2] = m[2].replace(/\s*=[^,)]*([,)])/g, '$1');
          this.text+= m[2];
        }
        if (pp.literals) for (ln in pp.literals) // literals restore
          this.text = this.text.replace(/['"\/]\.\.\.['"\/]/, pp.literals[ln]);
        if (lang == 'CSS') this.type = TYPE_STYLE;
        else {
          /// implicit access definitions
          this.type = TYPE_FUNCTION;
          if (line.match(/^\s*var\s+/)) this.type = TYPE_PRIVATE; else
          if (line.match(/^\s*this\.|:\s*function/)) this.type = TYPE_PUBLIC; else
          if (line.match(/^\s*[^.]+\..*=\s*function/)) this.type = TYPE_PUBLIC_STATIC;
          /// explicit access definitions
          if (line.match(/\bstatic\s+/)) {
            if (line.match(/^\s*private\s+/)) this.type = TYPE_PRIVATE_STATIC; else
            if (line.match(/^\s*protected\s+/)) this.type = TYPE_PROTECTED_STATIC; else
            this.type = TYPE_PUBLIC_STATIC;
          } else {
            if (line.match(/^\s*private\s+/)) this.type = TYPE_PRIVATE; else
            if (line.match(/^\s*protected\s+/)) this.type = TYPE_PROTECTED; else
            if (line.match(/^\s*public\s+/)) this.type = TYPE_PUBLIC;
          }
          if (lang == 'JavaScript') {
            if (line.match(_jQuery_match)) {
              this.text = this.text.replace(_jQuery_match, '');
              this.type = TYPE_JQUERY_EXT;
            } else
            if ((m = line.match(/([_$a-zA-Z][_$a-zA-Z0-9]*)\.prototype\b/))) {
              this.text = m[1] + '.prototype.' + this.text;
              this.type = TYPE_PROTOTYPE;
            }
          }
        }
        break;
      }
      updateNesting(line);
    };
  };
  /**
   * Tag parser for XML, XUL, XHTML and HTML
   * @param {string} lang detected language name
   */
  LineParserXML = function(lang) {
    /// Private properties
    var i, m, n, t, a, // index, matches, node, tag, attributes array
        _tag = /<([a-ż_][a-ż_0-9:]*(?:\s+[a-ż_][a-ż_0-9:]*\s*=\s*['"].*?['"])*)|(>)|(\/>)|(<\/[a-z][a-z0-9:]*\s*>)|(<!--)|(-->)/ig, // tag matching regex
        //_tag = /<([a-ż_][a-ż_0-9:]*)|(>)|(\/>)|(<\/[a-z][a-z0-9:]*\s*>)|(<!--)|(-->)/ig, // tag matching regex
        _empty = /\b(?:area|base|br|canvas|col|hr|img|input|link|meta|param)\b/i; // empty HTML tags
    /// Public properties
    this.nodes = []; // line nodes
    this.open = null; // currently opened node (multi-line)
    this.ignore = false; // set for comments
    /**
     * Single line parsing code, TIME CRITICAL
     * @param {string} line
     */
    this.parse = function(line, index) {
      this.nodes = [];
      line = line.replace(/^\s+|\s+$/, '');
      if (!line) return;
      var self = this;
      /**
       * Parses HTML tag into CSS selector
       * @param {string} tag HTML tag content
       * @returns {string} selector
       */
      var parseTag = function(tag) {
        var i, m, ts, as, n = [], v = [], a = {};
        m = tag.match(/^(\S+)\s*(.*)$/);
        ts = m[1]; as = m[2]; // tag string, attributes string
        if ((m = as.match(/".*?"/g))) { // match values in ""
          for (i in m) m[i] = m[i].replace(/^"|"$/g, '');
          v = v.concat(m);
        }
        if ((m = as.match(/'.*?'/g))) { // match values in ''
          for (i in m) m[i] = m[i].replace(/^'|'$/g, '');
          v = v.concat(m);
        }
        n = as.replace(/".*?"/g, '')
              .replace(/'.*?'/g, '')
              .replace(/\s+/g, '')
              .split('='); // match names
        as = ''; // new selector attributes string
        for (i in n) a[n[i]] = v[i]; // attributes object
        if (a['id']) { // id part
          as+= '#' + a['id'];
          delete a['id'];
        }
        if (a['class']) { // class part
          as+= '.' + a['class'].replace(/\s+/g, '.');
          delete a['class'];
        }
        for (i in a)
          if (i == 'name' || (ts == 'option' && i == 'value'))
            as+= '[' + i + '="' + a[i] + '"]'; // name / value part
        return ts + as;
      };
      /**
       * Parses a HTML line containing multiple tags
       * @param {object} self 'this' reference
       */
      var parseLine = function(self) {
        while ((m = _tag.exec(line))) {
          if (!self.ignore) {
            n = {};
            if (m[1]) { // tag opening
              n.open = true;
              if ((lang == 'HTML' || lang == 'HTML5') && m[1].match(_empty)) n.open = false;
              n.text = parseTag(m[1]);
              n.line = index * 1 + 1;
              self.open = n;
              // do we really need those huge attribute lists?
              if (line.substr(-n.text.length) === n.text) n.text+= '...';
            } else
            if (m[2]) { // tag ending
              if (!n.text && self.open) n = self.open;
              if (n.text) {
                if (!self.open) n.line = index * 1 + 1;
                self.nodes.push(n);
              }
              self.open = null;
            } else
            if (m[3]) { // tag closing
              if (!n.text && self.open) n = self.open;
              n.open = false;
              if (!self.open) n.line = index * 1 + 1;
              self.nodes.push(n);
              self.open = null;
            } else
            if (m[4]) { // closing tag
              n = {};
              n.open = false;
              self.nodes.push(n);
              self.open = null;
            }
            if (m[5]) { // comment start
              self.ignore = true;
            }
          }
          if (m[6]) { // comment end
            self.ignore = false;
          }
        }
      }(this);
    };
  };
  /**
   * Line parser for Python, because it's no other language like Python
   */
  LineParserPython = function() {
    this.document = ko.views.manager.currentView.koDoc;
    this.indent = this.document.indentWidth;
    this.index = -1; // processed line number
    this.text = null;
    this.type = TYPE_UNKNOWN; // set to TYPE_CLASS or TYPE_FUNCTION
    this.close = 0; // how many node levels to close before adding this node
    this.defBlock = 0; // def block offset state
    this.csBlock = 0; // cs block offset state
    this.csOffset = 0; // relative offset for control structure
    this.info = undefined; // aditional tooltip text
    var id = '[a-zA-Z][a-zA-Z0-9_.]*', // identifier match
        pp = new Preprocessor(id, ['#'], [], 'Python'); // preprocessor instance
    /**
     * Single Python line parsing code, TIME CRITICAL
     * @param {string} line
     */
    this.parse = function(line, index) {
      this.text = undefined; // initial state (for empty lines / unmatched)
      this.type = undefined; // initial state (for empty lines / unmatched)
      line = pp.parse(line, index, true); if (!line) return;
      var parts = line.match(/^(\s*)(.*?)\s*?$/), // main parts of the line
          whitespace = parts[1],
          code = parts[2],
          // When using tabbed indents with Python, whitespace.length is the indent level
          indent = whitespace[0] === '	' ? whitespace.length : whitespace.length / this.indent,
          defBlock = -1, // current def block indentation level
          csBlock = - 1, // current cs block indentation level
          csOffset = 0, // current block relative control structure offset
          i, // local index
          tab = ''; // single indentation string
      for (i = 0; i < this.document.tabWidth; i++) tab+= ' ';
      line = line.replace(/\t/g, tab);
      this.index = pp.defBlockReady ? (1 * pp.defBlockStart) : (1 * index);
      // non-empty nodes:
      if (code) {
        defBlock = -1; // like not found
        csBlock = -1; // like not found
        csOffset = 0; //
        if ((parts = code.match(/^class \s*(.*):$/))) {
          defBlock = indent; // matched class
          this.text = parts[1];
          this.type = TYPE_CLASS;
        } else if ((parts = code.match(/^class \s*(.*)$/))) {
          defBlock = indent; // matched multi-line class statement
          this.text = parts[1].concat(' ...)');
          this.type = TYPE_CLASS;
        } else if ((parts = code.match(/^def \s*(.*):$/))) {
          defBlock = indent; // matched def
          this.text = parts[1];
          this.type = TYPE_FUNCTION;
        } else if ((parts = code.match(/^def \s*(.*)$/))) {
          defBlock = indent; // matched multi-line def statement
          this.text = parts[1].concat(' ...)');
          this.type = TYPE_FUNCTION;
        } else if (code.match(/:$/)) { // matched control structure
          csBlock = indent;
          csOffset = this.csOffset + (
            this.defBlock >= this.csBlock
              ? indent - this.defBlock + 1 // THIS ONE IS IMPORTANT!!!
              : indent - this.csBlock
          );
        }
        if (defBlock >= 0) { // we have a definition block...
          if (defBlock <= this.csBlock) {
            this.csBlock = 0;
            this.csOffset = 0;
          }
          this.close = this.defBlock + this.csOffset - defBlock + 1; // determine how many levels to close
          this.defBlock = defBlock - this.csOffset; // remember the position in state
        }
        if (csBlock >= 0) { // we have control structure block...
          if (csBlock < this.csBlock) {
            this.csOffset-= this.csBlock - csBlock;
            this.csBlock = csBlock;
          } else this.csBlock = csBlock;
        }
        if (csOffset > 0) this.csOffset = csOffset;
      }
    };
  };

  LineParserCoffee = function() {
    this.document = ko.views.manager.currentView.koDoc;
    this.indent = this.document.indentWidth;
    this.index = -1; // processed line number
    this.text = null;
    this.type = TYPE_UNKNOWN; // set to TYPE_CLASS or TYPE_FUNCTION
    this.close = 0; // how many node levels to close before adding this node
    this.defBlock = 0; // def block offset state
    this.csBlock = 0; // cs block offset state
    this.csOffset = 0; // relative offset for control structure
    this.info = undefined; // aditional tooltip text
    var id = '[a-zA-Z][a-zA-Z0-9_.]*', // identifier match
        pp = new Preprocessor(id, ['#'], [], 'Coffee'); // preprocessor instance
    this.parse = function(line, index) {
      this.text = undefined; // initial state (for empty lines / unmatched)
      this.type = undefined; // initial state (for empty lines / unmatched)
      line = pp.parse(line, index, true); if (!line) return;
      var parts = line.match(/^(\s*)(.*?)\s*?$/), // main parts of the line
          whitespace = parts[1],
          code = parts[2],
          indent = whitespace.length / this.indent,
          defBlock = -1, // current def block indentation level
          csBlock = - 1, // current cs block indentation level
          csOffset = 0, // current block relative control structure offset
          i, // local index
          tab = ''; // single indentation string
      for (i = 0; i < this.document.tabWidth; i++) tab+= ' ';
      line = line.replace(/\t/g, tab);
      this.index = pp.defBlockReady ? (1 * pp.defBlockStart) : (1 * index);
      // non-empty nodes:
      if (code) {
        defBlock = -1; // like not found
        csBlock = -1; // like not found
        csOffset = 0; //
        if ((parts = code.match(/^class \s*(.+)$/))) {
          defBlock = indent; // matched class
          this.text = parts[1];
          this.type = TYPE_CLASS;
        } else if ((parts = code.match(/^(\w+)\s*:\s*(.*)[-=]>$/))) {
          defBlock = indent; // matched def
          this.text = parts[1] + parts[2];
          this.type = TYPE_FUNCTION;
        } else if ((parts = code.match(/^(.*),\s*(.*)[-=]>$/))) {
          defBlock = indent; // matched def
          this.text = '(anon.) ' + parts[1];
          this.type = TYPE_FUNCTION;
        } else if (code.match(/:$/)) { // matched control structure
          csBlock = indent;
          csOffset = this.csOffset + (
            this.defBlock >= this.csBlock
              ? indent - this.defBlock + 1 // THIS ONE IS IMPORTANT!!!
              : indent - this.csBlock
          );
        }
        if (defBlock >= 0) { // we have a definition block...
          if (defBlock <= this.csBlock) {
            this.csBlock = 0;
            this.csOffset = 0;
          }
          this.close = this.defBlock + this.csOffset - defBlock + 1; // determine how many levels to close
          this.defBlock = defBlock - this.csOffset; // remember the position in state
        }
        if (csBlock >= 0) { // we have control structure block...
          if (csBlock < this.csBlock) {
            this.csOffset-= this.csBlock - csBlock;
            this.csBlock = csBlock;
          } else this.csBlock = csBlock;
        }
        if (csOffset > 0) this.csOffset = csOffset;
      }
    };
  };

  /**
   * Unique Lua parser
   */
  LineParserLua = function() {
    /// Public properties
    this.document = ko.views.manager.currentView.koDoc;
    this.index = -1;
    this.text = null; // node text
    this.type = TYPE_UNKNOWN; // node type
    this.open = true; // if the node is open container for other nodes
    this.level = 0; // code nesting level
    this.nextLevelOffset = 0; // next level offset for \n before brace syntax
    this.nodeLevels = []; // nesting levels for nodes
    /// Private variables
    var id = '[a-zA-Z_][a-zA-Z0-9_.:]*';
    var self = this, // this access for private functions
        pp = new Preprocessor(id, ['--'], ['--[[', ']]'], 'Lua'), // preprocessor for literals and comments
        i, m; // index, matches
    var functions = ['*name = function()', '*function name()'], // function abstract RE array
      _functions = []; // function matching RE array
    /**
     * Parses class or function definition
     * @param {string} definition
     * @returns {RegExp}
     */
    var _parseDefinition = function(definition) {
      return new RegExp('^\\s*' +
        definition
          .replace(/\*/g, '.*?')
          .replace(/ = /g, '\\s*\\=\\s*')
          .replace(/name/g, '(' + id + ')')
          .replace(/\(\)/g, '\\s*(\\([^}{;]*\\))\\s*'));
    };
    /**
     * Line parser initialization
     */
    var _init = function() {
      /// function definition REs:
      if (functions && functions.length)
        for (i in functions) _functions.push(_parseDefinition(functions[i]));
    }(); // auto started here
    /**
     * Nesting analyzer, TIME CRITICAL
     * @param {string} line
     * @returns {number}
     */
    var updateNesting = function(line) {
      var o, p, lc = 0;
      if (line.match(/\bfunction\b/) || line.match(/\bdo\b/) || line.match(/\bif\b/) || line.match(/\bfor\b/)) lc++;
      if (line.match(/\bend\b/)) lc--;
      if (self.nextLevelOffset) {
        lc += self.nextLevelOffset;
        self.nextLevelOffset = 0;
      }
      self.level += lc;
      if (self.text) {
        self.nodeLevels.push(self.level);
        if (lc < 1) { // no level increase?
          if (line.match(/\bend\b/) || line.match(/,$/)) { // closed in the same line or block def?
            o = line.match(/\\bfunction\b(.*?)\\bend\b/); // one liners...
            if (o && !o[1] && !self.text.match(/[^a-zA-Z0-9_]/)) { // empty?
              self.nodeLevels.pop();
              self.text = null; // skip small empty nodes with common names
            } else {
              self.nodeLevels.pop();
              self.open = false;
            }
            return;
          } else { // no opening brace then
            self.level++; // bump level anyway
            self.nodeLevels[self.nodeLevels.length - 1] = self.level;
          }
        }
      }
      self.open = self.level >= self.nodeLevels.slice(-1)[0];
      if (!self.open) self.nodeLevels.pop();
    };
    /**
     * Resets line parser (call before each line)
     */
    var reset = function() {
      self.text = null;
      self.open= true;
    };
    /**
     * Single line parsing code, TIME CRITICAL
     * @param {string} line
     */
    this.parse = function(line, index) {
      reset();
      line = pp.parse(line, index); // code filtered, definition blocks matched
      if (!line) return;
      this.index = pp.defBlockReady ? (1 * pp.defBlockStart) : (1 * index);
      /// Matching functions
      if (_functions.length) // not inside started definition block
            for (i in _functions) // match must be done against all definitions
              if ((m = _functions[i].exec(line)) && m[1]) { // if matched:
        this.text = m[1];
        if (m[2]) { // default values will be removed:
          m[2] = m[2].replace(/\s*=[^,)]*([,)])/g, '$1');
          this.text+= m[2].replace(/\)\s.*$/, ')'); // one liners fix here
        }
        /// access definitions
        this.type = TYPE_PUBLIC;
        if (line.match(/^\s*local\s+/)) this.type = TYPE_PRIVATE; else
        if (line.match(/^\s*[^.:]+\..*=\s*function/) || line.match(/^\s*function\s*[^.:]+\.|\:.*/)) this.type = TYPE_FUNCTION;
      }
      updateNesting(line);
    };
  };
  /**
   * Simplify strings for Perl and Ruby
   */
  StringSimplifier = function(config) {
    var self = this; // this access for private functions

    this.wait_for_quote = null;
    this.wait_for_quote_list = [];
    this.wait_for_string_end_rx = null;
    this.wait_for_string_end_rx_ternary = null;

    var BRACE_PAIR = {
      '[' : ']',
      '(' : ')',
      '{' : '}',
      '<' : '>',
    };

    this.START_QUOTES_RX_LIST = config.START_QUOTES_RX_LIST;
    this.TERNARY = config.TERNARY;
    this.PRESERVE_1 = config.PRESERVE_1;
    this.COMMENT_RX_INDEX = config.COMMENT_RX_INDEX;
    this.HEREDOC_RX_INDEXES = config.HEREDOC_RX_INDEXES;
    this.END_DOCUMENT_RX = config.END_DOCUMENT_RX;
    this.NO_SUCH_STRING_RX = config.NO_SUCH_STRING_RX;
    this.START_DOCUMENTATION_RX = config.START_DOCUMENTATION_RX;
    this.END_DOCUMENTATION_RX = config.END_DOCUMENTATION_RX;
    this.START_LINEFEED_RX = config.START_LINEFEED_RX;
    this.END_LINEFEED_RX = config.END_LINEFEED_RX;
    this.HEREDOC_SPACE_ALLOWED = config.HEREDOC_SPACE_ALLOWED;
    this.TRAILING_PART = config.TRAILING_PART;

    var escape_regex = function(str) {
      return str.replace( /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&" );
    };

    var regex_to_string = function(rx) {
      rx += '';
      return rx.replace(/^\//,'')
        .replace(/\/$/,'');
    };

    // in one line due to bug in NST JS parser
    var get_multiline_regex = function(start_regex) {
      return new RegExp( regex_to_string(start_regex) + '.*$' );
    };

    var get_matching_pairs_of_delimeters_rx = function( start, end, depth, no_start ) {
      // no recursive regexes in js =(
      var rx_begin = '\\'+start+'(?:\\\\[^\\\\]|[^'+start+end+'\\\\]|\\\\\\\\';
      var rx_end = ')*\\'+end;

      var rx_string = '';
      if (depth) {
        rx_string = rx_begin + rx_end;
        for ( var i=1; i<depth; i++ ) {
          rx_string = rx_begin + '|' + rx_string + rx_end
        }
        if (no_start) {
          rx_string = rx_string.replace( '\\'+start, '' );
        }
      }

      return rx_string;
    }

    var get_single_delimeter_rx = function( start, no_start ) {
      var rx_string = '(?:\\\\[^' + start + '\\\\]|[^' + start + '\\\\]|'
        + '\\\\\\\\|\\\\' + escape_regex(start)
        + ')*' + escape_regex(start);

      return no_start
        ? rx_string
        : escape_regex(start) + rx_string;
    }

    var get_singleline_regex = function( start_regex, start, end, ternary, trailing_part ) {
      var singleline_regex_text = regex_to_string(start_regex);

      if ( start == end ) {
        var middle_end = get_single_delimeter_rx( start, 1 );
        if (ternary) {
          singleline_regex_text += middle_end + middle_end;
        }
        else {
          singleline_regex_text += middle_end;
        }
      }
      else {
        if (ternary) {
          singleline_regex_text
            += get_matching_pairs_of_delimeters_rx( start, end, 4, 1 )
            +  get_matching_pairs_of_delimeters_rx( start, end, 4, 0 );
        }
        else {
          singleline_regex_text
            += get_matching_pairs_of_delimeters_rx( start, end, 4, 1 );
        }
      }

      return new RegExp( singleline_regex_text + trailing_part );
    };

    this.simplify = function(line) {
      if ( self.wait_for_quote ) {
        if ( line.match(self.wait_for_quote) ) {
          self.wait_for_quote = self.wait_for_quote_list.shift();
        }
        line = '';
      }
      else if ( self.wait_for_string_end_rx ) {
        if ( line.match( self.wait_for_string_end_rx ) ) {
          line = line.replace( self.wait_for_string_end_rx, '' );
          self.wait_for_string_end_rx = null;
          if ( self.wait_for_string_end_rx_ternary ) {
            self.wait_for_string_end_rx = self.wait_for_string_end_rx_ternary;
            self.wait_for_string_end_rx_ternary = null;
            if ( line.match( self.wait_for_string_end_rx ) ) {
              line = line.replace( self.wait_for_string_end_rx, '' );
              self.wait_for_string_end_rx = null;
            }
            else {
              line = '';
            }
          }
        }
        else {
          line = '';
        }
      }

      if ( !self.wait_for_quote && !self.wait_for_string_end_rx && line != '' ) {
        if ( line.match( self.END_DOCUMENT_RX ) ) {
          self.wait_for_quote = self.NO_SUCH_STRING_RX; // no data till eof
          line = '';
        }
        else if ( line.match(self.START_DOCUMENTATION_RX) ) {
          self.wait_for_quote = self.END_DOCUMENTATION_RX;
          line = '';
        }
        else if ( line.match(self.START_LINEFEED_RX) ) {
          self.wait_for_quote = self.END_LINEFEED_RX;
        }
        else {
          while (1) {
            var first_match_index = null;
            var first_match_position = Infinity;
            for ( var i=0; i<self.START_QUOTES_RX_LIST.length; i++ ) {
              var regex = self.START_QUOTES_RX_LIST[i];
              var match_arr = line.match(regex);
              if ( match_arr ) {
                var match_text = match_arr[2];
                var position = line.indexOf(match_text);
                if ( i == self.COMMENT_RX_INDEX && match_text.charAt(0) != '#' ) {
                  position++;
                }
                if ( position < first_match_position ) {
                  first_match_position = position;
                  first_match_index = i;
                }
              }
            }

            if ( first_match_index != null ) {
              if ( first_match_index == self.COMMENT_RX_INDEX ) {
                line = line.substring(0,first_match_position);
              }
              else if ( self.HEREDOC_RX_INDEXES[first_match_index] ) {
                var start_regex = self.START_QUOTES_RX_LIST[first_match_index];
                var match_arr = start_regex.exec(line);
                var space = self.HEREDOC_SPACE_ALLOWED[first_match_index] ? '\\s*' : '';
                var new_regex = new RegExp(
                  '^' + space + regex_to_string(match_arr[4]) + '$'
                );
                if ( self.wait_for_quote ) {
                  self.wait_for_quote_list.push( new_regex );
                }
                else {
                  self.wait_for_quote = new_regex;
                }
                line = line.replace(start_regex,"$1\0");
              }
              else {
                var start_regex = self.START_QUOTES_RX_LIST[first_match_index];
                var match_arr = start_regex.exec(line);
                var start_of_string = match_arr[3];
                var end_of_string = BRACE_PAIR[start_of_string]
                  ? BRACE_PAIR[start_of_string]
                  : start_of_string;

                var trailing_part = self.TRAILING_PART[first_match_index]
                  ? regex_to_string( self.TRAILING_PART[first_match_index] )
                  : '';

                var singleline_regex = get_singleline_regex(
                  start_regex, start_of_string, end_of_string,
                  self.TERNARY[first_match_index], trailing_part );

                if ( line.match(singleline_regex) ) {
                  line = line.replace(singleline_regex,
                    self.PRESERVE_1[first_match_index] ? "$1\0" : "\0"
                  );
                }
                else {
                  if (self.TERNARY[first_match_index]) {
                    var middle = start_of_string == end_of_string
                      ? end_of_string // for non pair characters
                      : end_of_string + start_of_string; // for pair charecters '}{'
                    self.wait_for_string_end_rx = new RegExp(
                      '^.*?' + escape_regex(middle)
                    );
                    self.wait_for_string_end_rx_ternary = new RegExp(
                      '^.*?' + escape_regex(end_of_string) + trailing_part
                    );
                  }
                  else {
                    self.wait_for_string_end_rx = new RegExp(
                      '^(?:[^'
                        + escape_regex(end_of_string) + '\\\\]|[^\\\\]\\\\'
                        + escape_regex(end_of_string) + '|\\\\[^'
                        + escape_regex(end_of_string) + '\\\\])*?'
                        + escape_regex(end_of_string) + trailing_part
                    );
                  }

                  var multiline_regex = get_multiline_regex(start_regex);
                  line = line.replace(multiline_regex,
                    self.PRESERVE_1[first_match_index] ? "$1\0" : "\0"
                  );
                }
                // BUG: if delimeter is one of the "{[<("
                // in string can be balansed pairs of delimeter character (no escaping)
                // solved only for singleline strings
                // it is too complex to parse multilines
              }
            }
            else {
              break;
            }
          }
        }
      }
      line = line.replace( /\0/g, "''" );
      return line;
    };
  };
  /**
   * Line parser for Ruby
   */
  LineParserRuby = function() {
    var self = this; // this access for private functions
    this.index = -1; // processed line number
    this.text = null;
    this.info = null;
    this.type = TYPE_UNKNOWN; // set to TYPE_CLASS or TYPE_FUNCTION
    var id = '[a-zA-Z][a-zA-Z0-9_.]*[!?]?', // identifier match
        pp = new Preprocessor(id, ['#'], [], 'Ruby'); // preprocessor instance
    this.open = true;
    this.current_visibility = TYPE_PUBLIC;

    this.string_simplifier = new StringSimplifier({
      'START_QUOTES_RX_LIST' : [
        /(((?:^|[^$])#))/, // comments
        /()(<<(['"])(.*?)\3)/, // quoted heredoc
        /(^|[,=\(]\s*)(<<(((?:[^-=][^\s"']*)?))(?=[,;]?(?:$|\s)))/, // bare heredoc
        /()(<<-(['"])(.*?)\3)/, // quoted heredoc with leading "-"
        /()(<<-(((?:[^-=][^\s"']*)?))(?=[,;]?(?:$|\s)))/, // bare heredoc with leading "-"
        /(((['"`])))/, // simple quotes
        /((?:^|[^\w\s\/]|(?:^|[^$%&@\w])\w+)\s*)((\/))/, // regex delimeter
        /(^|[^$@%])((?:%[qQr]?)([^qQr{\[(<\w\s]))/, // q-quotes
        /(^|[^$@%])((?:%[qQr]?)( ))/, // %-quotes with ' ' delimeter
        /(^|[^$@%])((?:%[qQr]?)(\{))/, // %-quotes with "{}" delimeters
        /(^|[^$@%])((?:%[qQr]?)(\[))/, // %-quotes with "[]" delimeters
        /(^|[^$@%])((?:%[qQr]?)(\())/, // %-quotes with "()" delimeters
        /(^|[^$@%])((?:%[qQr]?)(\<))/, // %-quotes with "<>" delimeters
      ],
      'TERNARY' : [
        false, // comments
        null, // quoted heredoc
        null, // bare heredoc
        null, // quoted heredoc with leading "-"
        null, // bare heredoc with leading "-"
        false, // simple quotes
        false, // regex delimeter
        false, // q-quotes
        false, // %-quotes with ' ' delimeter
        false, // %-quotes with "{}" delimeters
        false, // %-quotes with "[]" delimeters
        false, // %-quotes with "()" delimeters
        false, // %-quotes with "<>" delimeters
      ],
      'PRESERVE_1' : [
        null, // comments
        null, // quoted heredoc
        null, // bare heredoc
        null, // quoted heredoc with leading "-"
        null, // bare heredoc with leading "-"
        false, // simple quotes
        true, // regex delimeter
        true, // %-quotes
        true, // %-quotes with ' ' delimeter
        true, // %-quotes with "{}" delimeters
        true, // %-quotes with "[]" delimeters
        true, // %-quotes with "()" delimeters
        true, // %-quotes with "<>" delimeters
      ],
      'TRAILING_PART' : [
        null, // comments
        null, // quoted heredoc
        null, // bare heredoc
        null, // quoted heredoc with leading "-"
        null, // bare heredoc with leading "-"
        null, // simple quotes
        /[a-z]*/, // regex delimeter
        null, // %-quotes
        null, // %-quotes with ' ' delimeter
        null, // %-quotes with "{}" delimeters
        null, // %-quotes with "[]" delimeters
        null, // %-quotes with "()" delimeters
        null, // %-quotes with "<>" delimeters
      ],
      'COMMENT_RX_INDEX' :       0, // no look behind in js regexes =(
      'HEREDOC_RX_INDEXES' :     [ null, 1, 1, 1, 1 ],
      'HEREDOC_SPACE_ALLOWED' :  [ null, false, false, true, true ],
      'END_DOCUMENT_RX' :        /^__END__$/,
      'NO_SUCH_STRING_RX' :      /$no-such-string^/,
      'START_DOCUMENTATION_RX' : /^=begin\b/,
      'END_DOCUMENTATION_RX' :   /^=end$/,
      'START_LINEFEED_RX' :      /^.*?\\$/,
      'END_LINEFEED_RX' :        /^.*?[^\\]$/,
    });

    var STATIC_PAIR = {};
    STATIC_PAIR[TYPE_PRIVATE]   = TYPE_PRIVATE_STATIC;
    STATIC_PAIR[TYPE_PUBLIC]    = TYPE_PUBLIC_STATIC;
    STATIC_PAIR[TYPE_PROTECTED] = TYPE_PROTECTED_STATIC;

    this.depth_in_blocks = new Array();
    this.current_depth_in_blocks = 0;
    var next_depth = function() {
      self.depth_in_blocks.push( self.current_depth_in_blocks );
      self.current_depth_in_blocks = 0;
      return null;
    };
    var prev_depth = function() {
      self.current_depth_in_blocks = self.depth_in_blocks.pop();
      return null;
    };
    var inc_depth = function() {
      self.current_depth_in_blocks++;
      return null;
    };
    var dec_depth = function() {
      self.current_depth_in_blocks--;
      if ( self.current_depth_in_blocks < 0 ) {
        prev_depth();
        return -1;
      }
      else {
        return self.current_depth_in_blocks;
      }
    };

    this.parse = function(line, index) {
      line = self.string_simplifier.simplify(line);
      self.text = undefined; // initial state (for empty lines / unmatched)
      self.type = undefined; // initial state (for empty lines / unmatched)
      self.info = undefined;
      self.open = true;
      line = pp.parse(line, index, true); if (!line) return;
      var parts = line.match(/^\s*(.*?)\s*?$/), // main parts of the line
        code = parts[1];
      self.index = pp.defBlockReady ? (1 * pp.defBlockStart) : (1 * index);
      // non-empty nodes:
      if (code) {
        if ( code.match(/^(?:class|module)\s*<</) ) {
          inc_depth();
        }
        else if ((parts = code.match(/^(?:class|module) \s*(\S+)/))) {
          self.text = parts[1];
          self.type = TYPE_CLASS;
          next_depth();
        }
        else if ((parts = code.match(/^def \s*([^\s\(]+)/))) {
          self.text = parts[1];
          self.type = self.current_visibility;
          if ((parts = self.text.match(/^self\.(.+)$/))) {
            self.text = parts[1];
            self.type = STATIC_PAIR[self.current_visibility];
          }
          else if ( self.text.match(/^[A-Z][^.\s]+\..+$/) ) {
            self.type = STATIC_PAIR[self.current_visibility];
          }
          next_depth();
        }
        else if ( code.match(/\s+do\b(?:\s*\|[a-zA-Z0-9_ \t,]*\|)?$/) ) {
          inc_depth();
        }
        else if ( code.match(/\bbegin$/) ) {
          inc_depth();
        }
        else if ( code.match(/^end\b/) ) {
          var depth = dec_depth();
          if ( depth == -1 ) {
            self.open = false;
          }
        }
        else if ( code.match(/^(if|unless|case|while)\b/) ) {
          inc_depth();
        }
        else if ( code.match(/^private$/) ) {
          self.current_visibility = TYPE_PRIVATE;
        }
        else if ( code.match(/^public$/) ) {
          self.current_visibility = TYPE_PUBLIC;
        }
        else if ( code.match(/^protected$/) ) {
          self.current_visibility = TYPE_PROTECTED;
        }
        self.info = self.text;
      }
    };
  };
  /**
   * Line parser for Perl
   */
  LineParserPerl = function() {
    var self = this; // this access for private functions

    this.index = -1;
    this.text = null; // node text
    this.type = TYPE_UNKNOWN; // node type
    this.open = true; // if the node is open container for other nodes
    this.removeLast = false; // if last node didn't match the brace required
    this.zeroIdentation = false;

    this.js_parser = new LineParserJS('Perl',
                                 ['package name'],
                                 ['*\\bsub name',
                                  '*\\bsub name()'],
                                 '[&a-zA-Z_][a-zA-Z0-9_\\:]*',
                                 []);

    this.string_simplifier = new StringSimplifier({
      'START_QUOTES_RX_LIST' : [
        /(((?:^|[^$])#))/, // comments
        /()(<<(['"])(.*?)\3)/, // quoted heredoc
        new RegExp( // bare heredoc
          '((?:^|[=./*,;]|=>|(?:^|[^-])-|(?:^|[^+])\\+'
          + '|chdir|chomp|chop|die|do|eval|glob|join|lc|lcfirst|length|mkdir'
          + '|print|printf|require|return|reverse|rmdir|say|split|sprintf'
          + '|substr|system|uc|ucfirst|unlink|warn'
          + ')\\s*)(<<((\\w+)))'
        ),
        /(((['"`])))/, // simple quotes
        /((?:^|[~\{\(!]|(?:^|[^$%&@\w])[a-zA-Z_]\w*)\s*)((\/))/, // regex delimeter
        /(^|[^$@%&])\b((?:q[qxwr]?|m)([^qxwr{\[(<\w\s]))/, // q-quotes, match
        /(^|[^$@%&])\b((?:q[qxwr]?|m) (\w))/, // q-quotes, match with alphabetic delimeters
        /(^|[^$@%&])\b((?:q[qxwr]?|m)(\{))/, // q-quotes, match with "{}" delimeters
        /(^|[^$@%&])\b((?:q[qxwr]?|m)(\[))/, // q-quotes, match with "[]" delimeters
        /(^|[^$@%&])\b((?:q[qxwr]?|m)(\())/, // q-quotes, match with "()" delimeters
        /(^|[^$@%&])\b((?:q[qxwr]?|m)(\<))/, // q-quotes, match with "<>" delimeters
        /(^|[^$@%&])\b((?:s|tr|y)([^{\[(<\w\s\\]))/, // s/tr/y
        /(^|[^$@%&])\b((?:s|tr|y) (\w))/, // s/tr/y with alphabetic delimeters
        /(^|[^$@%&])\b((?:s|tr|y)(\{))/, // s/tr/y with "{}{}" delimeters
        /(^|[^$@%&])\b((?:s|tr|y)(\())/, // s/tr/y with "()()" delimeters
        /(^|[^$@%&])\b((?:s|tr|y)(\[))/, // s/tr/y with "[][]" delimeters
        /(^|[^$@%&])\b((?:s|tr|y)(\<))/, // s/tr/y with "<><>" delimeters
      ],
      'TERNARY' : [
        false, // comments
        null, // quoted heredoc
        null, // bare heredoc
        false, // simple quotes
        false, // regex delimeter
        false, // q-quotes, match
        false, // q-quotes, match with alphabetic delimeters
        false, // q-quotes, match with "{}" delimeters
        false, // q-quotes, match with "[]" delimeters
        false, // q-quotes, match with "()" delimeters
        false, // q-quotes, match with "<>" delimeters
        true, // s/tr/y
        true, // s/tr/y with alphabetic delimeters
        true, // s/tr/y with "{}{}" delimeters
        true, // s/tr/y with "()()" delimeters
        true, // s/tr/y with "[][]" delimeters
        true, // s/tr/y with "<><>" delimeters
      ],
      'PRESERVE_1' : [
        null, // comments
        null, // quoted heredoc
        null, // bare heredoc
        false, // simple quotes
        true, // regex delimeter
        true, // q-quotes, match
        true, // q-quotes, match with alphabetic delimeters
        true, // q-quotes, match with "{}" delimeters
        true, // q-quotes, match with "[]" delimeters
        true, // q-quotes, match with "()" delimeters
        true, // q-quotes, match with "<>" delimeters
        true, // s/tr/y
        true, // s/tr/y with alphabetic delimeters
        true, // s/tr/y with "{}{}" delimeters
        true, // s/tr/y with "()()" delimeters
        true, // s/tr/y with "[][]" delimeters
        true, // s/tr/y with "<><>" delimeters
      ],
      'TRAILING_PART' : [
        null, // comments
        null, // quoted heredoc
        null, // bare heredoc
        null, // simple quotes
        /[a-z]*/, // regex delimeter
        // BUG: wrong parsing for q{text}s
        // (trailing "s" removed when code simplified)
        // but q{text}s is not a valid perl code
        /[a-z]*/, // q-quotes, match
        /[a-z]*/, // q-quotes, match with alphabetic delimeters
        /[a-z]*/, // q-quotes, match with "{}" delimeters
        /[a-z]*/, // q-quotes, match with "[]" delimeters
        /[a-z]*/, // q-quotes, match with "()" delimeters
        /[a-z]*/, // q-quotes, match with "<>" delimeters
        /[a-z]*/, // s/tr/y
        /[a-z]*/, // s/tr/y with alphabetic delimeters
        /[a-z]*/, // s/tr/y with "{}{}" delimeters
        /[a-z]*/, // s/tr/y with "()()" delimeters
        /[a-z]*/, // s/tr/y with "[][]" delimeters
        /[a-z]*/, // s/tr/y with "<><>" delimeters
      ],
      'COMMENT_RX_INDEX' :       0, // no look behind in js regexes =(
      'HEREDOC_RX_INDEXES' :     [ null, 1, 1 ],
      'HEREDOC_SPACE_ALLOWED' :  [ null, false, false ],
      'END_DOCUMENT_RX' :        /^__(?:END|DATA)__$/,
      'NO_SUCH_STRING_RX' :      /$no-such-string^/,
      'START_DOCUMENTATION_RX' : /^=\S/,
      'END_DOCUMENTATION_RX' :   /^=cut$/,
      'START_LINEFEED_RX' :      null,
      'END_LINEFEED_RX' :        null,
    });

    this.parse = function(line, index) {
      line = self.string_simplifier.simplify(line);
      var result = self.js_parser.parse( line, index );

      self.zeroIdentation = false;
      self.index = self.js_parser.index;
      self.text = self.js_parser.text;
      self.type = self.js_parser.type;
      self.open = self.js_parser.open;
      self.removeLast = self.js_parser.removeLast;

      if ( self.text != null ) {
        if ( self.type == TYPE_CLASS ) {
          self.zeroIdentation = true;
        }
        else if ( self.type == TYPE_FUNCTION ) {
          if ( line.match(/sub\s+[\w:]+\s*(?:\([\s$@%;\\]*\)\s*)?;/) ) { // prototypes
            self.open = false;
            self.type = TYPE_PROTOTYPE
          }
          else if ( self.text.match(/^_/) ) { // convention from Perl Best Practices
            self.type = TYPE_PRIVATE;
          }
          else {
            self.type = TYPE_PUBLIC;
          }
        }
      }

      return result;
    };
  };
  /**
   * Code parser, hack languages here:
   */
  CodeParser = {
    /** @type array **/
    lines : [],
    /** @type array **/
    map : [],
    /** @type nodeList **/
    nodeList : new nodeList(),
    /** @type nodeList **/
    backupList : new nodeList(),
    /** @type string **/
    lang : null,
    /** @type settings **/
    settings : false,
    /**
     * Current source to nodeList parser
     * @param view
     */
    parse : function() {
      var d = ko.views.manager.currentView.koDoc,
          l = this.lines = d.buffer.split(/\r?\n|\r/), // code lines
          n = this.nodeList = new nodeList(), // nodeList object
          b = this.backupList = new nodeList(), // backup nodeList
          p, // line parser
          i, // {string} line index
          j, // {number} extra index
          t, // type id for function (access dependent)
          id; // node id for map
      /**
       * Line parser selection & configuration
       * @param {object} self 'this' reference
       */
      var getLineParser = function(self) {
        switch (self.lang = d.language) {
          case 'CoffeeScript':
            p = new LineParserCoffee();
            break;
          case 'Node.js':
          case 'JavaScript':
            p = new LineParserJS(self.lang,
                                 ['name.prototype = {',
                                  '*name = {',
                                  'name : {'],
                                ['id.prototype.name = function()',
                                 'function name() {',
                                 '*name = function() {',
                                 '*name : function() {']);
            break;
          case 'ActionScript':
            p = new LineParserJS(self.lang,
                                 ['package name',
                                  '*class name',
                                  'name.prototype = {',
                                  'name.prototype : {',
                                  '*name = {',
                                  'name : {'],
                                 ['*function name():type {',
                                  '*name = function():type {',
                                  '*name : function():type {'],
                                  '[a-zA-Z_$][.a-zA-Z0-9_$:]*',
                                  ['#', '//']);
            break;
          case 'PHP':
            p = new LineParserJS(self.lang,
                                 ['*class name*',
                                  'interface name {'],
                                 ['*function name() {'],
                                  '[&$a-żA-Ż_][a-żA-Ż0-9_]*',
                                 ['#', '//']);
            break;
          case 'Perl':
            p = new LineParserPerl();
            break;
          case 'Python':
          case 'Python3':
            p = new LineParserPython();
            break;
          case 'SCSS':
          case 'Sass':
          case 'LESS': 
          case 'CSS':
            p = new LineParserJS(self.lang,
                                 ['@name,'],
                                 ['name {'],
                                 '[\\-*#.a-zA-Z_]' +
                                 '[ =\\"\\]\\[\\)\\(\\->:,*#.a-zA-Z0-9_]*',
                                 null);
            break;
          case 'XML':
          case 'XUL':
          case 'XSLT':
          case 'XHTML':
          case 'HTML':
          case 'HTML5':
            p = new LineParserXML(self.lang);
            break;
          case 'Lua':
            p = new LineParserLua();
            break;
          case 'C++':
            p = new LineParserJS(self.lang,
                                 ['class name'],
                                 ['[^else\\s\\(\\)]+\\s+name() {'],
                                  '[\*a-zA-Z_][.a-zA-Z0-9_:]*',
                                 ['//'],
                                 ['/*', '*/']);
            break;
          case 'Ruby':
            p = new LineParserRuby();
            break;
          case 'Bash':
            p = new LineParserJS(self.lang,
                                 [''],
                                 ['*function name() {',
                                  'name() {'],
                                  '[&$a-żA-Ż_][a-żA-Ż0-9_]*',
                                 ['#']);
            break;
        }
      }(this);
      /**
       * Language specific options switching
       * @param {object} self 'this' reference
       */
      var switchOptions = function(self) {
        if (self.lang.match('HTML')) {
          self.settings.hide('sort');
          self.settings.show('HTMLfilter');
        } else {
          self.settings.show('sort');
          self.settings.hide('HTMLfilter');
        }
      }(this);
      /// Skip following if not enough data to process
      if (p && this.lang && this.lines.length) {
        /**
         * Code parser loop
         * @param {object} self 'this' reference
         */
        var parseLines = function(self) {
          /// Code parser loop:
          window.setCursor('wait');
          self.map = [];
          for (i in self.lines) {
            id = false;
            p.parse(self.lines[i], i);
            if (p.nodes) { // multiple tag in line
              var li, lNode;
              for (li in p.nodes) { // LineParserXML
                lNode = p.nodes[li];
                if (lNode.text) id = n.add(lNode.text, lNode.line, TYPE_TAG);
                if (!lNode.open) n.end();
              }
            } else if (self.lang == 'Python' || self.lang == 'Python3') { // LineParserPython
              if (p.type) {
                if (p.close) n.end(p.close);
                if (p.text) id = n.add(p.text, p.index + 1, p.type, p.info);
              }
            } else { // LineParserJS
              if (p.removeLast) {
                n.nodes.pop();
                n.end();
              }
              else {
                if (p.zeroIdentation) n.zeroIdentation();
                if (p.text) id = n.add(p.text, p.index + 1, p.type, p.info);
                if (!p.open) n.end();
              }
            }
            if (id !== false && typeof(self.map[1 * i]) == 'undefined')
              self.map[1 * i] = 1 * id;
          }
        }(this);
        /**
         * Post-processing loop
         * @param {object} self 'this' reference
         */
        var postProcess = function(self) {
          /// Post-processing
          var c, r = /[#.[]/, f = self.settings.get('HTMLfilter');
          for (i in n.nodes) {
            c = n.nodes[i]; // current node
            // JavaScript classes:
            if (self.lang == 'JavaScript' && c.type == TYPE_FUNCTION) {
              if (c.hasChildNodesIn(n.nodes)) c.type = TYPE_CLASS; else
              if (c.parent) c.type = TYPE_PRIVATE;
            } else
            // HTML node filter:
            if (f && self.lang.match('HTML') && !c.text.match(r) && !c.search(r, n.nodes)) {
              id = n.nodes[i].id;
              delete n.nodes[i];
              delete self.map[self.map.indexOf(id)];
              continue;
            }
            b.nodes.push(c);
          }
        }(this);
        /**
         * Reverse mapping loop
         * @param {object} self 'this' reference
         */
        var reverseMap = function(self) {
          /// Reverse mapping
          for (i = j = 0; i < self.lines.length; i++) { // all lines of reverse map to be covered...
            if (typeof(self.map[i]) != 'undefined') j = 1 * self.map[i];
            else self.map[i] = j;
          }
        }(this);
        window.setCursor('auto');
      }
    }
  };
  /**
   * Source tree view class
   * @see _sourceTreeView.prototype#getCellProperties
   * @constructor
   */
  function SourceTreeViewClass() {
    var s = Components.classes["@mozilla.org/atom-service;1"]
            .getService(Components.interfaces.nsIAtomService);
    this._rows = [];
    this._nodes = [];
    this._map = [];
    this._icons = [
      s.getAtom('Unknown'),
      s.getAtom('Class'),
      s.getAtom('Function'),
      s.getAtom('MethodPrivate'),
      s.getAtom('MethodProtected'),
      s.getAtom('MethodPublic'),
      s.getAtom('Prototype'),
      s.getAtom('PrototypeClass'),
      s.getAtom('MethodPrivateStatic'),
      s.getAtom('MethodProtectedStatic'),
      s.getAtom('MethodPublicStatic'),
      s.getAtom('jQueryExt'),
      s.getAtom('Tag'),
      s.getAtom('Style'),
      s.getAtom('AtRule')
    ];
  }
  /**
   * Source tree view class prototype
   */
  SourceTreeViewClass.prototype = {

    /** Unused, but required by treeView interface **/
    getRowProperties : function(row, prop) {},
    /** Unused, but required by treeView interface **/
    getColumnProperties : function(column, prop) {},
    /** Unused, but required by treeView interface **/
    cycleCell : function(row, colId) {},
    /** Unused, but required by treeView interface **/
    isSorted : function() { return false; },
    /** Unused, but required by treeView interface **/
    getImageSrc : function() { return null; },
    /** Unused, but required by treeView interface **/
    cycleHeader : function() {},
    /** Unused, but required by treeView interface **/
    isSeparator : function(row) { return false; },

    /**
     * Connects this tree view to the tree data object
     * @param {object} treeData
     */
    setTree : function(treeData) { this.tree = treeData; },
    /**
     * Gets current cell text
     * @returns {string}
     */
    getCellText : function(row, column) { return this._rows[row][TR_TEXT];},
    /**
     * Gets current view row count
     * @returns {number}
     */
    getRowCount : function() { return this._rows.length; },
    /**
     * Returns a data node by its id property
     * @param {number} id
     * @returns {node}
     */
    getNodeById : function(id) {
      for (var i in this._nodes)
        if (this._nodes[i].id == id) return this._nodes[i];
      return null;
    },
    /**
     * Returns a data node associated with a row
     * @param {number} row
     * @returns {node}
     */
    getNodeByRow : function(row) {
      if (!row && row !== 0) return null;
      row = this._rows[row];
      if (typeof(row) == 'undefined') return null;
      for (var i in this._nodes)
        if (this._nodes[i].id == row[TR_ID]) return this._nodes[i];
      return null;
    },
    /**
     * Actually this sets cell properties (icons from node type)
     * @param {number} row
     * @param {number} column not used here
     * @param properties cell properties to modify
     */
    getCellProperties : function(row, column, properties) {
      try {
        if (properties) properties.AppendElement(this._icons[this.getNodeByRow(row).type]);
        else return this._icons[this.getNodeByRow(row).type];
      } catch(e) { xtk2.debug.exceptionHandler(e, NAME); }
    },
    /**
     * Gets rows tree level
     * @param {number} row
     * @returns {number}
     */
    getLevel : function(row) {
      return this._rows[row][TR_LEVEL];
    },
    /**
     * Returns the parent row index of the queried row
     * A bug here makes nice crashes
     * @returns {number}
     */
    getParentIndex: function(row) {
      if (this.isContainer(row)) return -1;
      for (var i = row - 1; i >= 0 ; i--) if (this.isContainer(i)) return i;
      return - 1;
    },
    /**
     * Returns true if a node contains other nodes
     * @param {number} row
     * @returns {boolean}
     */
    isContainer : function(row) {
      for (var i in this._nodes)
        if (this._nodes[i].parent == this._rows[row][TR_ID]) return true;
      return false;
    },
    /**
     * Returns true if a container node is open
     * @param {number} row
     * @returns {boolean}
     */
    isContainerOpen : function(row) {
      return this._rows[row][TR_OPEN];
    },
    /**
     * Returns true if container contains no nodes
     * @param {number} row
     */
    isContainerEmpty : function(row) {
      return false; // no empty containers possible with this isContainer def.
    },
    /**
     * Returns true if a row has next sibling, UNUSED here
     * @param {number} row
     * @param {number} after
     * @returns {boolean}
     */
    hasNextSibling : function(row, after) { return false; },
    /**
     * Row open / close handler
     * @param {number} row
     */
    toggleOpenState : function(row) {
      try {
        if (this._toggleOpenStateLock) return;
        this._toggleOpenStateLock = true;
        this.selection.clearSelection();
        var i = row, deleteCount = 0;
        if (this._rows[row][TR_OPEN]) {
          this._rows[row][TR_OPEN] = false;
          while (++i < this._rows.length &&
                 this._rows[i][TR_LEVEL] > this._rows[row][TR_LEVEL]) deleteCount++;

          this._rows.splice(row + 1, deleteCount);
          this.tree.rowCountChanged(row + 1, -deleteCount);
        } else {
          this._rows[row][TR_OPEN] = true;
          var entries = this.getChildren(row).reverse();
          for (i in entries) this._rows.splice(row + 1, 0, entries[i]);
          this.tree.rowCountChanged(row + 1, entries.length);
        }
        this.tree.invalidateRow(row);
        this.mapRows();
      } catch(e) { xtk2.debug.exceptionHandler(e, NAME); }
      finally {
        delete this._toggleOpenStateLock;
      }
    },
    /**
     * Creates lines to tree rows mapping
     */
    mapRows : function() {
      var i = 0, j = 0, l = 0;
      this._map = [];
      for (i in this._rows) {
        l = CodeParser.map.indexOf(this._rows[i][2]);
        this._map[l] = 1 * i;
      }
      for (i = 0; i < CodeParser.map.length; i++) {
        if (typeof(this._map[i]) != 'undefined') j = this._map[i];
        else this._map[i] = j;
      }
    },
    /**
     * Sets rows array to root level nodes
     * @TODO: restore expanded nodes
     * @param {array} nodes
     */
    setRows : function(nodes) {
      this._nodes = nodes;
      var i, new_rows = [];
      this.selection.clearSelection();
      for (i in this._nodes)
        if (!this._nodes[i].parent)
          new_rows.push([this._nodes[i].text,
                         0, // root level
                         this._nodes[i].id,
                         false, // closed by default
                         -1]);

      this.tree.rowCountChanged(0, -this._rows.length);
      this._rows = new_rows;
      this.tree.rowCountChanged(0, this._rows.length);
      this.mapRows();
    },
    /**
     * Returns code line associated with given row
     * @param {number} row
     * @returns {number} line number
     */
    getLinePosition: function(row) {
      return this.getNodeByRow(row).line;
    },
    /**
     * Returns child nodes for opened container
     * @param {number} row
     * @returns {array} child rows
     */
    getChildren: function(row) {
      var i, children = [];
      for (i in this._nodes)
        if (this._nodes[i].parent == this._rows[row][TR_ID])
          children.push([this._nodes[i].text,
                         this._rows[row][TR_LEVEL] + 1,
                         this._nodes[i].id,
                         false,
                         this._rows[row][TR_ID]]);
      return children;
    },
    /**
     * Toggles open state for each tree row
     */
    toggleOpenAll : function() {
      for (var i = 0; i < this._rows.length; i++)
        if (this.isContainer(i)) this.toggleOpenState(i);
    }
  };
  /**
   * Class for holding information on the tree and it's tree view. Object used
   * for interaction between the xul and data.
   * @constructor
   */
  function NSTClass() { this.init(); }
  /**
   * Source tree container prototype
   */
  NSTClass.prototype = {
    /**
     * Source tree initialization required after panels swapped
     * @param {boolean} elements if true only elements will be updated
     */
    init : function(elements) {
      try {
        this.source_tree = document.getElementById('NST');
        this.search_box = document.getElementById('NST-search-text');
        this.node_info = document.getElementById('NST-node-info');
        if (elements) return;
        this.sourceTreeView = new SourceTreeViewClass();
        this.sourceTreeView.setTree(this.source_tree);
        this.source_tree.treeBoxObject.view = this.sourceTreeView;
        this.unchanged = false;
        main.NST = this;
        main.NSTBox = this.source_tree.treeBoxObject;
        main.NSTView = this.sourceTreeView;
      } catch (e) { xtk2.debug.exceptionHandler(e, NAME); }
    },
    /**
     * Loads tree nodes into rows
     * @param {array} filtered (optional)
     */
    loadTree : function(filteredNodes) {
      try {
        this.sourceTreeView.setRows(filteredNodes
                            ? filteredNodes
                            : CodeParser.nodeList.nodes);
        if (main.settings.get('expand')) this.sourceTreeView.toggleOpenAll();
      } catch (e) { xtk2.debug.exceptionHandler(e, NAME); }
    },
    /**
     * Sorts tree nodes by type, then by name
     */
    sortTree : function() {
      try {
        if (!CodeParser.lang.match('HTML'))
          CodeParser.nodeList.nodes.sort(function(a, b) {
            if (a.type == b.type) {
              if (a.text.toLocaleLowerCase() == b.text.toLocaleLowerCase()) return 0;
              if (a.text.toLocaleLowerCase() < b.text.toLocaleLowerCase()) return -1;
              return 1;
            } else {
              if (a.type < b.type) return - 1;
              else return 1;
            }
          });
      } catch(e) { xtk2.debug.exceptionHandler(e, NAME); }
    },
    /**
     * Filters tree
     * @returns {boolean} if filtering done
     */
    filterTree : function() {
      try {
        var s = this.search_box.value,
            v = this.sourceTreeView,
            i,
            nodes = []; // to be filtered
        if (!s) return false;
        for (i in CodeParser.nodeList.nodes)
          nodes.push(CodeParser.nodeList.nodes[i]);
        for (i = nodes.length -1;  i >= 0; i--)
          if (nodes[i].text.toLowerCase().indexOf(s.toLowerCase()) < 0 &&
              !nodes[i].search(s, nodes))
            delete nodes[i];
        if (nodes) this.loadTree(nodes); else return false;
        return true;
      } catch (e) { xtk2.debug.exceptionHandler(e, NAME); return false; }
    },
    /**
     * Reload feature
     * @param {object} view
     */
    reloadSource : function() {
      try {
        if (!this.sourceTreeView.tree) this.init();
        CodeParser.settings = main.settings;
        CodeParser.parse();
        if (main.settings.get('sort')) this.sortTree();
        if (!this.filterTree()) this.loadTree();
        if (main.settings.get('locate')) main.locateLine();
        this.viewChanged = false;
      } catch (e) { xtk2.debug.exceptionHandler(e, NAME); }
    }
  };
  /**
   * Expands / collapses all container nodes
   * Called from XUL
   */
  this.toggleExpand = function() {
    this.settings.change('expand');
    NST.sourceTreeView.toggleOpenAll();
  };
  /**
   * Gets specific tree node from mouse event
   * @param {Event} event
   * @returns {node}
   */
  this.getNodeFromEvent = function(event) {
    var r = {}, c = {}, d = {}, n,
        t = NST.source_tree,
        v = NST.sourceTreeView,
        b = t.boxObject;
    b.getCellAt(event.clientX, event.clientY, r, c, d);
    return v.getNodeByRow(r.value);
  };
  /**
   * Centers editor on the line associated with selected row
   * Called from XUL
   * @param event (tree node click)
   */
  this.go = function(event) {
    try {
      var t = NST.sourceTreeView,
          v = ko.views.manager.currentView,
          row = t.selection.currentIndex;
      if (!t.getRowCount()) return false;
      if (row > -1) {
        // Save current location to history before jumping
        ko.history.note_curr_loc(v);
        // Jump
        v.scimoz.gotoLine(t.getLinePosition(row) - 1);
        v.setFocus();
        ko.commands.doCommand('cmd_editCenterVertically');
      }
    } catch (e) { xtk2.debug.exceptionHandler(e, NAME); }
    return false;
  };
  /**
   * Displays a node info in a tooltip if set
   * @param {Event} event
   */
  this.nodeInfo = function(event) {
    try {
      var n = this.getNodeFromEvent(event),
          i =  NST.node_info;
      if (n && n.info) i.value = n.info;
      else event.preventDefault();
    } catch (e) { xtk2.debug.exceptionHandler(e, NAME); }
  };
  /**
   * Locates current line in source tree
   * Called from window event listeners: keypress, click
   */
  this.locateLine = function(event) {
    if (!ko.views.manager.currentView) return;
    try {
      if (event && event.keyCode && // Ingore for most keys except...
          event.keyCode != 33 && // PgUp
          event.keyCode != 34 && // PgDn
          event.keyCode != 38 && // Up
          event.keyCode != 40) return; // Down
      var s = ko.views.manager.currentView.scimoz; // current editor
          if (!s) return; // incompatible window event
      var t = NST, // shortcut for main tree object
          v = t.sourceTreeView, // tree view (to access rows)
          b = t.source_tree.treeBoxObject, // tree box (for one method)
          l = s.lineFromPosition(s.currentPos) + 1, // current editor line
          r = v._map[l - 1], // current mapped row
          h = b.getPageLength(), // visible rows count
          m = Math.floor(h / 2); // middle row index
      // row selection
      try { v.selection.select(r); } catch (e) { return; };
      // scrolling as close as possible to the middle
      if (r - m < 1) b.scrollToRow(0);
      else if (r + m > v._rows.length) b.scrollToRow(v._rows.length - h);
      else b.scrollToRow(r - m);
    } catch (e) { xtk2.debug.exceptionHandler(e, NAME); }
  };
  /**
   * Sets line auto-locate feature
   */
  this.setAutoLocate = function(state) {
    var w = parent && parent.window ? parent.window : window;
    if (state) {
      w.addEventListener('click', main.locateLine, false);
      w.addEventListener('keyup', main.locateLine, false);
    } else {
      w.removeEventListener('click', main.locateLine, false);
      w.removeEventListener('keyup', main.locateLine, false);
    }
  };
  /**
   * Toggles line auto-locate setting
   */
  this.toggleLocate = function() {
    try {
      var s = this.settings.change('locate');
      this.setAutoLocate(s);
      if (s) this.locateLine();
    } catch (e) { xtk2.debug.exceptionHandler(e, NAME); }
  };
  this.toggleHTMLfilter = function() {
    try {
      var s = this.settings.change('HTMLfilter');
      this.refresh();
    } catch (e) { xtk2.debug.exceptionHandler(e, NAME); }
  }
  /**
   * Refresh button handler
   * Called from XUL
   * @param view (current view)
   */
  this.refresh = function() {
    try {
      if (ko.views.manager.currentView &&
          ko.views.manager.currentView.koDoc &&
          ko.views.manager.currentView.koDoc.buffer) {
        if (!NST) NST = new NSTClass();
        // Here we prevent reloading when source tree is not visible:
        if (typeof ko.uilayout.isTabShown === 'function') { // Komodo 7 way
          // FOLLOWING LINE DOESN'T WORK WITH KOMODO 8!!!
          //if (!ko.uilayout.isTabShown('NST-viewbox')) return;
        } else { // Komodo 6 way
          var t = document.getElementById('NST_tab');
          if (!t || !t.parentNode.selectedItem ||
              t.parentNode.selectedItem.id != 'NST_tab' ||
              t.parentNode.parentNode.parentNode.collapsed) return;
        }
        NST.reloadSource();
      } else NST.init();
    } catch (e) { xtk2.debug.exceptionHandler(e, NAME); }
  };
  /**
   * Toggles tree sorting
   * Called from XUL
   */
  this.toggleSort = function() {
    try {
      this.settings.change('sort');
      this.refresh();
    } catch (e) { xtk2.debug.exceptionHandler(e, NAME); }
  };
  /**
   * Removes search filter from displayed tree
   * Called from XUL
   */
  this.removeFilter = function() {
    try {
      var t = NST;
      t.search_box.value = '';
      t.loadTree();
    } catch (e) {
      xtk2.debug.exceptionHandler(e, NAME);
    }
  };
  /**
   * Filters displayed tree with search text
   * Called from XUL
   */
  this.search = function() {
    try {
      var t = NST;
      if (t.search_box.value) t.filterTree(); else t.loadTree();
    } catch (e) { xtk2.debug.exceptionHandler(e, NAME); }
  };
  /**
   * Extension settings module
   */
  this.settings = {
    /**
     * Initial settings (if none set)
     */
    defaults : {
      left : false,
      locate : true,
      expand : true,
      sort : false,
      HTMLfilter : false
    },
    /**
     * Switches toolbar icon to a new state
     * @param {string} id XUL id
     * @param {boolean} state
     */
    _switchIcon : function(id, state) {
      var i, icon = document.getElementById(id), classes;
      if (icon) {
        classes = icon.getAttribute('class').split(' ');
        if (state) {
          if (classes.indexOf('active') < 0) classes.push('active');
        } else {
          if ((i = classes.indexOf('active')) >= 0) delete classes[i];
        }
        icon.setAttribute('class', classes.join(' '));
        icon.setAttribute('checked', state);
      }
    },
    /**
     * Updates toggle-icons to their current states
     */
    updateIcons : function() {
      for (var p in this.defaults)
        this._switchIcon('NST-toggle-' + p, this.get(p));
    },
    /**
     * Loads a boolean setting from extension prefs
     * @returns {boolean}
     */
    get : function(name) {
      return xtk2.services.prefs.prefs.getBooleanPref('extensions.NST.' + name);
    },
    /**
     * Save a boolean setting to extension prefs
     * @param {string} name
     */
    set : function(name, value) {
      xtk2.services.prefs.prefs.setBooleanPref('extensions.NST.' + name, value);
    },
    /**
     * Changes a boolean setting in extension prefs
     * @returns {boolean} new value
     */
    change : function(name) {
      var result;
      this.set(name, result = !this.get(name));
      this.updateIcons();
      return result;
    },
    show : function(name) {
      var id = 'NST-toggle-' + name,
          icon = document.getElementById(id);
      if (icon) icon.style.display = 'block';
    },
    hide : function(name) {
      var id = 'NST-toggle-' + name,
          icon = document.getElementById(id);
      if (icon) icon.style.display = 'none';
    },
    /**
     * Initialization with defaults
     * Called by main init, REQUIRED
     */
    init : function() {
      for (var p in this.defaults) {
        if (!xtk2.services.prefs.prefs.hasBooleanPref('extensions.NST.' + p))
          this.set(p, this.defaults[p]);
      }
    }
  };
  /**
   * Extension loader
   */
  this.load = function() {
    try {
      main.settings.init(); // this loads defaults if ran for the first time
      main.settings.updateIcons(); // now it's done here
      NST = new NSTClass();
      xtk2.events.bind(
        ['current_view_changed',
         'current_project_changed',
         'current_view_language_changed',
         'file_changed'],
        main.refresh
      );
      xtk2.events.view_closed(function(event) {
        // if no more views - this removes the last source from the tree
        if (!ko.views.manager._viewCount) self.refresh();
      });
      if (main.settings.get('locate')) main.setAutoLocate(true);
      main.refresh();
    } catch(e) { xtk2.debug.exceptionHandler(e, NAME); }
  };
  window.setTimeout(main.load, 1000, false);
}).apply(ko.extensions.NST);
