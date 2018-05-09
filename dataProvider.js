/* jshint esversion:6 */

Object.defineProperty( exports, "__esModule", { value: true } );

var vscode = require( 'vscode' );
var path = require( "path" );
var fs = require( 'fs' );

var elements = [];

const PATH = "path";
const TODO = "todo";

var nextId = 1;

class TodoDataProvider
{
    constructor( _context, defaultRootFolder )
    {
        this._context = _context;
        this.defaultRootFolder = defaultRootFolder;

        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getChildren( element )
    {
        if( !element )
        {
            if( elements.length > 0 )
            {
                return elements;
            }
            return [ { name: "Nothing found" } ];
        }
        else if( element.type === PATH )
        {
            if( element.elements && element.elements.length > 0 )
            {
                return element.elements;
            }
            else
            {
                return element.todos;
            }
        }
        else if( element.type === TODO )
        {
            return element.text;
        }
    }

    getTodoIcon( text )
    {
        function isHexColour( text )
        {
            return ( typeof text === "string" ) && ( text.length === 3 || text.length === 6 ) && !isNaN( parseInt( text, 16 ) );
        }

        var colourMappings = vscode.workspace.getConfiguration( 'todo-tree' ).iconColours;

        var colour = "";

        for( var mapping in colourMappings )
        {
            if( colourMappings.hasOwnProperty( mapping ) )
            {
                if( text.match( mapping ) )
                {
                    colour = colourMappings[ mapping ];
                }
            }
        }

        if( colour === "" )
        {
            colour = vscode.workspace.getConfiguration( 'todo-tree' ).iconColour;
        }

        var darkIconPath;
        var lightIconPath;

        if( isHexColour( colour.substr( 1 ) ) )
        {
            var iconPath = path.join( this._context.storagePath, "todo-" + colour.substr( 1 ) + ".svg" );
            if( !fs.existsSync( iconPath ) )
            {
                if( !fs.existsSync( this._context.storagePath ) )
                {
                    fs.mkdirSync( this._context.storagePath );
                }

                var content =
                    "<?xml version=\"1.0\" encoding=\"iso-8859-1\"?>" +
                    "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"" +
                    "\tviewBox=\"0 0 426.667 426.667\" style=\"enable-background:new 0 0 426.667 426.667;\" xml:space=\"preserve\">" +
                    "<path style=\"fill:" + colour + ";\" d=\"M213.333,0C95.518,0,0,95.514,0,213.333s95.518,213.333,213.333,213.333" +
                    "\tc117.828,0,213.333-95.514,213.333-213.333S331.157,0,213.333,0z M174.199,322.918l-93.935-93.931l31.309-31.309l62.626,62.622" +
                    "\tl140.894-140.898l31.309,31.309L174.199,322.918z\"/>" +
                    "</svg>";

                fs.writeFileSync( iconPath, content );
            }

            darkIconPath = iconPath;
            lightIconPath = iconPath;
        }
        else
        {
            darkIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "dark", "todo-" + colour + ".svg" ) );
            lightIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "light", "todo-" + colour + ".svg" ) );
        }

        var icon = {
            dark: darkIconPath,
            light: lightIconPath
        };

        return icon;
    }

    getTreeItem( element )
    {
        let treeItem = new vscode.TreeItem( element.name + ( element.pathLabel ? element.pathLabel : "" ) );

        treeItem.id = nextId++;

        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.resourceUri = new vscode.Uri.file( element.file );
        treeItem.tooltip = element.file;

        if( element.type === PATH )
        {
            treeItem.collapsibleState = vscode.workspace.getConfiguration( 'todo-tree' ).expanded ?
                vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;

            if( element.todos && element.todos.length > 0 )
            {
                treeItem.iconPath = vscode.ThemeIcon.File;
            }
        }
        else if( element.type === TODO )
        {
            treeItem.iconPath = this.getTodoIcon( element.name );

            treeItem.command = {
                command: "todo-tree.revealTodo",
                title: "",
                arguments: [
                    element.file,
                    element.line
                ]
            };
        }

        return treeItem;
    }

    clear()
    {
        elements = [];
    }

    add( rootFolder, match )
    {
        var fullPath = path.resolve( rootFolder, match.file );
        var relativePath = path.relative( rootFolder, fullPath );
        var parts = relativePath.split( path.sep );

        var pathElement;

        var todoElement = {
            type: TODO, name: match.match.substr( match.column - 1 ), line: match.line - 1, file: fullPath
        };

        var flat =
            relativePath.startsWith( ".." ) ||
            rootFolder === this.defaultRootFolder ||
            vscode.workspace.getConfiguration( 'todo-tree' ).flat;

        if( flat )
        {
            var findExactPath = function( e )
            {
                return e.type === PATH && e.file === this;
            };

            var child = elements.find( findExactPath, fullPath );

            if( !child )
            {
                var folder = relativePath.startsWith( '..' ) ? path.dirname( fullPath ) : path.dirname( relativePath );
                var pathLabel = ( folder === "." ) ? "" : " (" + folder + ")";
                pathElement = {
                    type: PATH, file: fullPath, name: path.basename( fullPath ), pathLabel: pathLabel, path: relativePath, todos: []
                };

                elements.push( pathElement );
            }
            else
            {
                pathElement = child;
            }
        }
        else
        {
            var findSubPath = function( e )
            {
                return e.pathLabel === undefined && e.type === PATH && e.name === this;
            };

            var parent = elements;
            parts.map( function( p, level )
            {
                var child = parent.find( findSubPath, p );
                if( !child )
                {
                    var subPath = path.join( rootFolder, parts.slice( 0, level + 1 ).join( path.sep ) );
                    pathElement = {
                        type: PATH, file: subPath, name: p, parent: pathElement, elements: [], todos: []
                    };
                    parent.push( pathElement );
                }
                else
                {
                    pathElement = child;
                }
                parent = pathElement.elements;
            } );
        }

        if( !pathElement.todos.find( element => { return element.name === todoElement.name && element.line === todoElement.line; } ) )
        {
            pathElement.todos.push( todoElement );
        }
    }

    refresh( setViewVisibility )
    {
        this._onDidChangeTreeData.fire();
        if( setViewVisibility === true )
        {
            vscode.commands.executeCommand( 'setContext', 'todo-tree-has-content', elements.length > 0 );
        }
    }
}
exports.TodoDataProvider = TodoDataProvider;
