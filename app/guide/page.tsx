export const metadata = { title: "Style Guide" };

export default function GuidePage() {
    return (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 leading-relaxed sm:p-8">
            <h1 className="text-3xl font-bold">“Style Guide”</h1>

            <p>
                Welcome to <strong>compend</strong>. On here, you can review anything
                that has a Wikipedia article. The articles themselves aren’t displayed,
                so I suggest (gently) that you review the concepts themselves, rather
                than their associated Wikipedia pages. You can also make ranked or
                unranked lists of these concepts.
            </p>

            <p>
                That’s about the only gentle suggestion I can think of. This is of
                little importance to you, but I designed this site with two obsessive
                user-archetypes in mind, namely that of the Diarist and of the
                Codifier.
            </p>

            <p>
                The Diarist chronically appraises experience. They log “Hello
                (Salutation)” quite soon after having greeted someone. To the Diarist,
                items are instances. “Hello (Salutation)” will be logged approximately
                4,000 times over the course of a decade. The Diarist, holidaying in
                Italy, crouches over a Lenovo Trackpad to give Italy 3-and-a-half
                stars. Perhaps a meandering journal entry is written. One could imagine
                the Diarist combing through a recursively shortened moment, never quite managing to log everything in it.
            </p>

            <p>
                The Codifier is more concerned with the imposition of a kind of order
                on the world. Perhaps they’d simply like to make a novel observation
                about every given thing, or rank all 7,500 edible apple varieties in
                descending order, taking rigorous taste notes for each. The Codifier
                thinks of items not as instances, but as representatives for a larger
                class of objects. Unlike the Diarist, they have little to say about
                themselves. Their satisfaction lies in an interminable but concrete
                sense of progression.
            </p>

            <p>
                Neither of these people exist, and even these brief descriptions
                overlap somewhat. I just like websites that I can lose myself to
                completely for no reason, and it’s fun to imagine characters
                undertaking Borgesian tasks on mine. Have your fun.
            </p>
        </main>
    );
}