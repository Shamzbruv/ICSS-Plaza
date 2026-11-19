const products = [
    { id: 'prism', name: 'Prism Bead Stack', category: 'Bracelets', price: 4500, description: 'Iridescent facets with fuchsia and deep plum beads.', option: 'Wrist size', choices: ['Small', 'Medium', 'Large'] },
    { id: 'rings', name: 'Liquid Gold Ring', category: 'Rings', price: 3200, description: 'A sculptural, gold-tone accent with three silhouettes to try.', option: 'Style', choices: ['Oval', 'Loop', 'Droplet'] },
    { id: 'dragonfly', name: 'Dragonfly Pendant', category: 'Necklaces', price: 3800, description: 'A silver-tone dragonfly on a slim black cord.', choices: ['One size'] },
    { id: 'wristlet', name: 'Afterglow Wristlet', category: 'Accessories', price: 2500, description: 'Rainbow-catching beads and a vintage-inspired charm for your keys.', choices: ['One size'] },
    { id: 'pearl', name: 'Blush Pearl Drops', category: 'Earrings', price: 4200, description: 'Pearlescent drops with vivid berry accents.', choices: ['One size'], concept: true },
    { id: 'lagoon', name: 'Lagoon Bracelet', category: 'Bracelets', price: 3900, description: 'Turquoise and violet beads with a hammered gold-tone focal bead.', option: 'Wrist size', choices: ['Small', 'Medium', 'Large'], concept: true }
];
const bag = new Map();
const byId = id => document.getElementById(id);
const money = amount => 'J$' + amount.toLocaleString('en-JM');
const node = (tag, value) => {
    const element = document.createElement(tag);
    if (value) element.textContent = value;
    return element;
};

function updateBag() {
    const lines = byId('bag-lines');
    lines.replaceChildren();
    let count = 0;
    let subtotal = 0;
    for (const [key, { product, choice, quantity }] of bag) {
        count += quantity;
        subtotal += product.price * quantity;
        const line = node('div');
        line.className = 'bag-line';
        const remove = node('button', 'Remove');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Remove ' + product.name + ', ' + choice);
        remove.onclick = () => {
            bag.delete(key);
            byId('status').textContent = '';
            updateBag();
        };
        line.append(node('span', product.name + ' · ' + choice + ' × ' + quantity), node('span', money(product.price * quantity)), remove);
        lines.append(line);
    }
    if (!count) lines.append(node('p', 'Your bag is empty.'));
    byId('bag-count').textContent = count;
    byId('total').textContent = count ? 'Subtotal ' + money(subtotal) : '';
    byId('checkout-area').hidden = !count;
}

function openProduct(product, updateLink = true) {
    const image = node('img');
    image.src = './' + product.id + '.webp';
    image.alt = product.name;
    image.className = 'detail-photo';
    const title = node('h2', product.name);
    title.id = 'detail-title';
    const controls = node('div');
    controls.className = 'detail-controls';
    const select = node('select');
    select.id = 'product-option';
    select.append(...product.choices.map(choice => node('option', choice)));
    if (product.option) {
        const label = node('label', product.option);
        label.htmlFor = select.id;
        controls.append(label, select);
    }
    const add = node('button', 'Add to bag');
    add.type = 'button';
    add.className = 'primary';
    add.onclick = () => {
        const choice = select.value;
        const key = product.id + '/' + choice;
        bag.set(key, { product, choice, quantity: (bag.get(key)?.quantity || 0) + 1 });
        updateBag();
        byId('detail').close();
        byId('status').textContent = product.name + ' added to your bag.';
        byId('bag').showModal();
    };
    const share = node('a', 'Link to this piece ↗');
    share.href = '?piece=' + product.id;
    controls.append(add, share);
    byId('detail-body').replaceChildren(image, title, node('p', product.description), node('p', money(product.price)), controls);
    if (updateLink) history.replaceState(null, '', '?piece=' + product.id);
    byId('detail').showModal();
}

function showCollection(category) {
    const collection = products.filter(product => category === 'All' || product.category === category);
    byId('products').replaceChildren(...collection.map(product => {
        const card = node('article');
        card.className = 'product';
        const button = node('button');
        button.type = 'button';
        const image = node('img');
        image.src = './' + product.id + '.webp';
        image.alt = '';
        image.loading = 'lazy';
        button.append(image, node('h3', product.name), node('p', money(product.price)));
        if (product.concept) {
            const label = node('span', 'Concept piece');
            label.className = 'concept';
            button.append(label);
        }
        button.onclick = () => openProduct(product);
        card.append(button);
        return card;
    }));
}

document.querySelectorAll('[data-filter]').forEach(button => {
    button.onclick = () => {
        document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        showCollection(button.dataset.filter);
    };
});
byId('detail').addEventListener('close', () => history.replaceState(null, '', location.pathname));
byId('open-bag').onclick = () => {
    byId('status').textContent = '';
    updateBag();
    byId('bag').showModal();
};
byId('checkout').onclick = () => {
    const fulfilment = byId('fulfilment').value.toLowerCase();
    bag.clear();
    updateBag();
    byId('status').textContent = 'Sample order complete for ' + fulfilment + '.';
};
showCollection('All');
const requested = products.find(product => product.id === new URLSearchParams(location.search).get('piece'));
if (requested) openProduct(requested, false);
