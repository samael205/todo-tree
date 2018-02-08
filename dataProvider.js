Object.defineProperty( exports, "__esModule", { value: true } );
var vscode = require( 'vscode' );
var path = require( "path" );

var elements = [];

const PATH = "path";
const TODO = "todo";

String.prototype.hashCode = function()
{
    var hash = 0, i, chr;
    if( this.length === 0 ) return hash;
    for( i = 0; i < this.length; i++ )
    {
        chr = this.charCodeAt( i );
        hash = ( ( hash << 5 ) - hash ) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

class TodoDataProvider
{
    constructor( _context )
    {
        this._context = _context;

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

    getTodoIcon()
    {
        let icon = {
            dark: this._context.asAbsolutePath( path.join( "resources/icons", "dark", "todo.svg" ) ),
            light: this._context.asAbsolutePath( path.join( "resources/icons", "light", "todo.svg" ) )
        };
        return icon;
    }

    getTreeItem( element )
    {
        let treeItem = new vscode.TreeItem( element.name );
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.resourceUri = new vscode.Uri.file( element.file );

        if( element.type === PATH )
        {
            treeItem.id = element.file.hashCode();
            treeItem.collapsibleState = vscode.workspace.getConfiguration( 'todo-tree' ).expanded ?
                vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
        }
        else if( element.type === TODO )
        {
            treeItem.id = ( element.file + element.line ).hashCode();
            treeItem.iconPath = this.getTodoIcon();

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

    markForRemoval( element )
    {
        element.canBeDeleted = true;
        element.elements.map( function( element )
        {
            markForRemoval( element );
        } );
    }

    refresh()
    {
        elements.map( function( element )
        {
            markForRemoval( element );
        } );
        elements = [];
        vscode.commands.executeCommand( 'setContext', 'todo-tree-has-content', false );
        this._onDidChangeTreeData.fire();
    }

    prune()
    {
    }

    remove( rootFolder, filename )
    {
        var removed = false;

        var fullPath = path.resolve( rootFolder, filename );
        var relativePath = path.relative( rootFolder, fullPath );
        var parts = relativePath.split( path.sep );

        function findSubPath( e )
        {
            return e.type === PATH && e.name === this;
        }

        var me = this;
        var pathElement;
        var parent = elements;
        parts.map( function( p, i )
        {
            var child = parent.find( findSubPath, p );
            if( !child || i === parts.length - 1 )
            {
                while( child )
                {
                    var elementArray = child.parent ? child.parent.elements : elements;
                    elementArray.splice( elementArray.indexOf( child ), 1 );
                    me._onDidChangeTreeData.fire( child );
                    if( elementArray.length === 0 )
                    {
                        child = child.parent;
                    }
                    else
                    {
                        child = undefined;
                    }
                    removed = true;
                }
            }
            else
            {
                pathElement = child;
                parent = pathElement.elements;
            }
        } );

        if( elements.length === 0 )
        {
            vscode.commands.executeCommand( 'setContext', 'todo-tree-has-content', false );
        }

        return removed;
    }

    add( rootFolder, match )
    {
        vscode.commands.executeCommand( 'setContext', 'todo-tree-has-content', true );

        var fullPath = path.resolve( rootFolder, match.file );
        var relativePath = path.relative( rootFolder, fullPath );
        var parts = relativePath.split( path.sep );

        var pathElement;

        var todoElement = {
            type: TODO, name: match.match.substr( match.column - 1 ), line: match.line - 1, file: fullPath
        };

        if( vscode.workspace.getConfiguration( 'todo-tree' ).flat )
        {
            function findPath( e )
            {
                return e.type === PATH && e.path === this;
            }

            var child = elements.find( findPath, relativePath );

            if( !child )
            {
                var folder = path.dirname( relativePath );
                var pathLabel = ( folder === "." ) ? "" : " (" + folder + ")";
                pathElement = {
                    type: PATH, file: fullPath, name: path.basename( fullPath ) + pathLabel, path: relativePath, todos: []
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
            function findSubPath( e )
            {
                return e.type === PATH && e.name === this;
            }

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

        pathElement.todos.push( todoElement );

        this._onDidChangeTreeData.fire();
    }

    refresh()
    {
        this._onDidChangeTreeData.fire();
    }
}
exports.TodoDataProvider = TodoDataProvider;
