export function setCssProps(el: HTMLElement, props: Record<string, string>) {
    for (const [key, value] of Object.entries(props)) {
        el.style.setProperty(key, value);
    }
}
