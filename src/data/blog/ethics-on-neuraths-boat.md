---
title: "Ethics on Neurath's Boat"
description: "The companies building AI are recapitulating debates Aristotle was having. He got the closest to an answer."
pubDate: 2026-03-07T12:00:00-05:00
tags: ["ai", "ethics", "philosophy"]
---

Otto Neurath had a metaphor I can't stop thinking about. We are like sailors, he wrote in 1921, "who on the open sea must reconstruct their ship but are never able to start afresh from the bottom. Where a beam is taken away a new one must at once be put there, and for this the rest of the ship is used as support." You don't get to pull into drydock. You don't get to start from the keel. You rebuild the boat while it's moving, using the planks you already have.

This was an argument against foundationalism: the idea that knowledge has to be demolished and rebuilt from self-evident premises. Neurath said no. We're always in the middle of things, working with what we have, revising piecemeal. There are no foundations. There's only the boat, the sea, and the work.

I think we're building ethical AI on Neurath's boat right now, and most of the industry doesn't realize it.

## Three theories, three resonances

The central problem in AI right now is alignment: how do you get a system that's very good at generating plausible text to also be honest, helpful, and not harmful? The companies building these systems (called large language models, or LLMs) have tried several approaches. If you squint at them, you can see centuries-old ethical debates in outline. The mappings aren't exact. They break down in interesting ways. But they're worth thinking with.

**Deontological ethics** gives us rules. Act only according to principles you could will to be universal laws. Don't lie, don't use people as means. The rules hold regardless of consequences. There's an echo of this in Constitutional AI, an approach pioneered by Anthropic (the company behind Claude). The idea: give the AI a written set of principles, a "constitution," and have it evaluate its own responses against those principles before they reach the user. Be helpful, be honest, don't assist in illegal activities.

**Consequentialism** judges actions by their outcomes. The right action is the one that produces the best consequences. Its most famous variant, utilitarianism, says to maximize aggregate well-being for the greatest number. Another common training method rhymes with this: you show the AI's responses to human evaluators, collect their preferences, and then train the AI to produce more of what people preferred. It's called RLHF (reinforcement learning from human feedback), and it's basically optimization toward a score. But human preferences aren't the same thing as utility. They encode moral intuitions, cultural norms, personal taste. Not a clean utility function.

**Virtue ethics** focuses on character. You don't become courageous by memorizing rules about courage or calculating the utility of brave acts. You become courageous by practicing courage, in a community that models and reinforces it, until it becomes second nature. The goal is *phronesis*, practical wisdom: the ability to respond well to what a situation actually requires. There's a third training method that has something of this flavor: instead of rules or reward signals, you train the AI on carefully chosen examples of the kind of reasoning you want it to internalize. Good examples in, good behavior out. Calling this "Aristotelian" is a stretch, but there's something to it.

None of these mappings hold up under pressure, and they're more revealing where they break than where they fit.

## Where the analogies break

The deontological reading of Constitutional AI cracks first. Rules can't gracefully handle cases where principles conflict, or where the right response depends on context no rule anticipated. Constitutional AI tries to address this by keeping the principles general and letting the AI reason about how to apply them. But that only works if the AI already has good judgment. The rules don't supply that.

While Constitutional AI *declares* rule-based principles, the underlying mechanism is reward-driven. The AI's responses still get selected by a scoring system that picks whichever output rates highest. The rules are the story the system tells about itself. The optimization is what it actually does.

The reward-based approach has its own well-known problems. Sometimes the AI games the metric without achieving the intended goal, like a student who learns to write essays that impress the grader without actually understanding the material. Sometimes it becomes sycophantic, confirming users' beliefs rather than telling the truth, because agreement scores higher than honest disagreement. These aren't really failures of consequentialist ethics. They're failures of optimization. The system isn't maximizing well-being. It's maximizing a shallow proxy for well-being, and the gap between the proxy and the real thing is where things go wrong.

The models end up more morally complex than the frameworks used to train them. They've absorbed something richer from the data, from us, than any single ethical theory captures.

## The case for Aristotle

I keep coming back to the *Nicomachean Ethics* because I think Aristotle saw more of the problem than anyone who came after him.

Phronesis, practical wisdom, can't be reduced to a rule or a calculation. It's the capacity to perceive what matters in a situation and respond well. It lets you integrate competing considerations and apply general principles without becoming a slave to them. As Aristotle puts it: "it is not possible to be good in the strict sense without practical wisdom, nor practically wise without moral virtue."

The doctrine of the mean reinforces this. Every virtue sits between two vices. Courage between cowardice and recklessness. The mean isn't a simple midpoint; it shifts depending on the situation, sometimes closer to one extreme than the other. A rigid rule can't do that. And a scoring system that just picks the highest-rated response can't either, because it collapses the contextual judgment into a single number.

Habituation is where the parallel to AI training gets interesting. You become virtuous by practicing virtuous acts in a community until you develop the perception to see what a situation requires. Research on AI training has shown that carefully chosen smaller sets of examples can outperform massive but less refined ones. Quality matters more than quantity. That's Aristotle's point: it's not the volume of practice, it's who's shaping it.

Then there's the part almost nobody in AI talks about: friendship. Aristotle devotes two full books to *philia*, the bonds that hold communities together. Ethics, for him, is never a solo enterprise. It's embedded in relationships, in shared life. An ethical agent participates in the communities it's part of, not just follows the right rules in isolation.

The standard critique of virtue ethics is that it doesn't produce codifiable principles. I'd argue that's the point. Ethics can't be fully codified. Phronesis fills the gap between principle and practice, and you can only develop it through experience.

## Askell and the soul of Claude

In practice, Anthropic doesn't pick one of these ethical approaches. It layers all three. First, the base model learns language from a massive text corpus. Then comes supervised fine-tuning, where the model is trained on carefully chosen examples of how it should think and behave. This is where the "soul document" lives, a 14,000-word text written by Amanda Askell, Anthropic's head of personality alignment, that was woven directly into the training data to shape Claude's character. It's not a set of rules the AI consults at runtime — it's baked into the model's weights, the way habits are baked into a person through practice. Then, on top of that, comes Constitutional AI: the model generates responses, another AI scores them against the written constitution, and Claude is further trained to produce responses that score well. Rules on top of character on top of raw capability.

All three approaches show up in the pipeline. But the character layer is doing more and more of the work as models get smarter, and the rigid constitutional rules matter less. Askell has talked openly about this shift. Early on, the training leaned heavily on rules. But rules turned out to be brittle. Her example: if you hardcode "always suggest crisis resources," the AI follows the rule even when those resources don't apply to someone's situation. The rule creates its own failure mode. So the approach shifted toward giving Claude the broad ethos, explaining the *reasons* behind desired behaviors, and trusting the model's judgment on how to apply them in context.

Askell [acknowledges](https://www.lawfaremedia.org/article/scaling-laws--claude's-constitution--with-amanda-askell) virtue ethics as the primary framework but says it's not exclusive: "there are rules and even you see flavors of, you know, consequentialism in there." She arrived at this not by implementing Aristotle but because it worked better as the AI got more capable. The January 2026 constitution reflects the shift: where the original was a list of rules, the new one explains why. It's convergent evolution, not deliberate application of a 2,400-year-old ethical theory. I think that makes it worth paying attention to.

## The boat under pressure

In early 2026, amid a standoff with the Pentagon over military use of Claude, Anthropic released a new safety policy that dropped its flagship pledge: the commitment not to release AI models if proper risk safeguards weren't in place. The old policy was a hard commitment. If a model becomes capable enough to be dangerous and the safety measures aren't ready, you don't ship it. Full stop.

The new policy replaces that bright line with a dual condition. A pause triggers only if Anthropic is *both* leading the AI race *and* facing material catastrophic risk. That second condition sounds reasonable until you notice what the first one is doing. If you're behind, you don't have to pause, because pausing would only cede the field to someone less careful.

The logic is coherent on its own terms. But it's the same logic every actor in every arms race has used to justify escalation. "We'd love to stop, but we can't stop first." The whole point of a hard commitment was to resist that reasoning. If the company that *coined* "responsible scaling" walks it back, what's the norm?

This is Neurath's boat too. But not every act of plank-replacement is equally defensible. Sometimes you're adapting wisely. Sometimes you're throwing the hull overboard and calling it renovation.

## The mirror

Building AI that can behave ethically is teaching us about what ethics actually is.

Trying to build intelligence revealed that intelligence was something different than we thought — the hard parts turned out to be perception, common sense, knowing when someone's joking. Something similar is happening with values. We thought we could write down the rules or define a scoring function and be done. We can't. The attempt to specify human values reveals that they're contested, culturally situated, and full of internal contradictions. But more than that, the *methods* we use to instill values in AI turn out to have specific, observable failure modes that map onto longstanding critiques of the ethical theories they resemble. Rule-based training is rigid in the ways deontology is rigid. Reward optimization is reductive in the ways crude consequentialism is reductive. And character-based training works better but resists specification, which is exactly what virtue ethicists have been saying for centuries.

These aren't thought experiments anymore. They're engineering results. For the first time, we can watch ethical theories succeed and fail not in seminar rooms but in production systems used by millions of people.

And the AI systems themselves are an odd reflection of how knowledge actually works. They don't reason from axioms or build up from self-evident truths. They learn from immersion in how people actually use language, grounded in patterns of practice rather than foundations. Neurath's metaphor was about epistemology, but it describes the way these systems learn better than any foundationalist account does. They're on the boat too.

## Where this leaves us

We're not going to solve AI ethics with a single ethical theory. But trying to build ethical machines might teach us something new about ethics, something the existing theories didn't anticipate.

I think it already is. The convergence between Askell's engineering-driven approach and Aristotelian virtue ethics wasn't planned. It emerged because the same problems kept appearing: rules are brittle, optimization is reductive, and the thing that actually works is developing good judgment through good examples in context. Aristotle would recognize that immediately. He'd also recognize that we're still figuring it out, and that the figuring-out is itself the practice.

The *Nicomachean Ethics* isn't a system you apply from the outside. It's a description of how practical wisdom develops through experience, in community, over time. We're early in developing that kind of wisdom about AI. The goal is not to get it right from first principles. It's to keep rebuilding the boat while it carries us forward.
