const jsdom = require('jsdom');
const fs = require('fs');
const node_path = require('path');

function capitalize(word) {
    const [first, ...rest] = word.split('');
    return [first.toUpperCase()].concat(rest).join('');
}

function clean_name(title, cleanName) {
    return `${title.split('[', 1).join('')}.${cleanName}`;
}

function clean_function_name(name) {
    return `${name.innerHTML.split('[', 1).join('')}`;
}

function get_names(type, title, elt) {
    const all_siblings = [];
    while (elt !== null && elt.tagName !== 'H2') {
        if (elt.tagName === 'H3') {
            const id = elt.getAttribute('id');
            const name = clean_function_name(elt);
            if (!name.startsWith('_')) {
                all_siblings.push({
                    id,
                    type,
                    name: clean_name(title, name)
                });
            }
        }
        elt = elt.nextElementSibling;
    }

    return all_siblings;
}

function public_constructors(title, document) {
    const cons = document.getElementById('constructors');
    if (cons === null) {
        return [];
    }

    return get_names('Constructor', title, cons.nextElementSibling);
}

function public_behaviours(type, title, document) {
    if (type !== 'Actor') {
        return [];
    }

    const be = document.getElementById('public-behaviours');
    if (be === null) {
        return [];
    }

    return get_names('Method', title, be.nextElementSibling);
}

function public_functions(type, title, document) {
    const cons = document.getElementById('public-functions');
    if (cons === null) {
        return [];
    }

    const dash_type = type === 'Primitive' ? 'Function' : 'Method';
    return get_names(dash_type, title, cons.nextElementSibling);
}

function parse_field(field) {
    return field.split(' ', 2)[1].split(':', 1)[0];
}

function get_field_name(title, field) {
    return `${title.split('[', 1).join('')}.${field}`;
}

function gather_fields(title, elt) {
    const all_siblings = [];
    while (elt !== null && elt.tagName !== 'H2') {
        if (elt.tagName === 'UL') {
            const field_name = parse_field(elt.children[0].textContent);
            all_siblings.push({
                id: 'public-fields',
                type: 'Field',
                name: get_field_name(title, field_name)
            });
        }

        elt = elt.nextElementSibling;
    }

    return all_siblings;
}

function public_fields(title, document) {
    const cons = document.getElementById('public-fields');
    if (cons !== null) {
        return gather_fields(title, cons.nextElementSibling);
    }

    return [];
}

function get_file_type(document) {
    const currents = Array.from(
        document.getElementsByClassName('current')
    ).filter(e => e.tagName === 'A');
    const current_a = currents.length === 1 ? currents[0] : undefined;
    if (current_a) {
        return capitalize(current_a.textContent.split(' ', 1)[0]);
    }

    return null;
}

function get_file_title(url, type, document) {
    if (type === 'Package') {
        return document
            .getElementsByClassName('wy-breadcrumbs')[0]
            .children[1].textContent.split(' ')[1];
    }

    const raw_title_element = document.getElementsByTagName('h1')[0];
    return raw_title_element.innerHTML.split('[', 1)[0];
}

function to_dash_type(type) {
    if (type === 'Actor') {
        return 'Class';
    }

    if (type === 'Primitive') {
        return 'Module';
    }

    return type;
}

function parse_doc(root, url, document) {
    const file_type = get_file_type(document);
    const title = get_file_title(url, file_type, document);
    const file_details = {
        name: title,
        type: to_dash_type(file_type),
        path: relPath(root, url)
    };

    const constructors = public_constructors(title, document);
    const fields = public_fields(title, document);
    const behaviours = public_behaviours(file_type, title, document);
    const functions = public_functions(file_type, title, document);

    const all_functions = constructors
        .concat(fields)
        .concat(behaviours)
        .concat(functions)
        .map(elt => {
            const { type: pony_type, name, id } = elt;
            const rel_url = relPath(root, url);
            const real_url = `${rel_url}#${id}`;
            return { name, type: to_dash_type(pony_type), path: real_url };
        });

    all_functions.unshift(file_details);
    return all_functions;
}

function relPath(root, url) {
    return node_path.relative(root, url);
}

function parse(rootPath, dirPath) {
    if (!dirPath.endsWith('.html')) {
        if (dirPath.endsWith('/')) {
            dirPath = dirPath + 'index.html';
        } else {
            dirPath = dirPath + '/index.html';
        }
    }

    const url_fd = fs.readFileSync(dirPath);
    const dom = new jsdom.JSDOM(url_fd);
    const file_details = parse_doc(rootPath, dirPath, dom.window.document);
    return file_details;
}

module.exports = {
    parse
};
