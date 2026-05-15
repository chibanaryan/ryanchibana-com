---
title: "An Accounting I Do Not Trust"
description: "There is a kind of analysis I was trained to do, and another kind I was not."
pubDate: 2026-05-14T12:00:00-05:00
tags: ["career", "ethics", "technology", "philosophy"]
---

There is a kind of analysis I was trained to do, and another kind I was not.

In computer science you are taught, very early, to think carefully about complexity. Time complexity, space complexity: the way the resource demands of a procedure grow as the size of the problem grows. You learn to say of an algorithm that it runs in linear time, or quadratic, or exponential. You learn that one approach is asymptotically better than another. The analysis becomes a precondition for serious work. The inability or unwillingness to perform it is a marker of an unserious technologist.

There is another kind of complexity I think we should be analyzing with the same rigor and are not. The moral complexity of the systems we build. The institutions whose responsiveness they presuppose. The capacities they exercise and the ones they atrophy. The question of who absorbs the friction. We treat this as soft, optional, the domain of ethics committees, the thing you say before you get to the technical content. I think it is one of the costliest deficiencies in our discipline, and the source of a great deal of harm we are individually unable to perceive and collectively unable to prevent.

Taking this complexity seriously is a capacity I have been trying to develop. We all have gaps in our training.

## The car that did not stop

Some moments break through. The first time I felt, with any force, the gap between the technical analysis I was good at and the moral analysis I was not, I was at my desk reading what had happened at [Cruise](https://sfstandard.com/2024/11/14/cruise-fine-investigation-dragging-robotaxi/).

A pedestrian had been hit by a hit-and-run driver in San Francisco and thrown into the path of a Cruise robotaxi, which dragged her some distance before stopping. She suffered life-threatening injuries. The case was eventually settled. The reporting that followed made clear that the company's failures, which led to a suspended permit and eventually to the unwinding of the entire program, were as much about what was disclosed to regulators as about what had happened on the street. I had worked there, on the ML data pipelines for the trajectory planning model. By any narrow technical accounting, I was at a remove from the decisions in question. And still I sat with the news in a way I had not sat with any work-related news before, sick to my stomach, unable to focus in the days and even weeks that followed.

The question I have been asking myself ever since is not whether I bear specific causal responsibility for what happened. I don't think I do. The question is whether I was deficient in perceiving the morally relevant aspects of the situation while I was inside it. Not the specific incident. I could not have anticipated that. The broader shape. The financial pressure the company was under, the race to a deployable product, the kinds of corner-cutting that get rationalized inside a company on a financial lifeline. I can produce, in retrospect, all the reasons I was technically removed from any of it. I did not work on operations. I did not interact with regulators. I built infrastructure that processed sensor data. The reasons are true. They are also a kind of accounting I do not entirely trust.

I felt the speed. We had weeks, at one point, to scale the volume of data the trajectory ranking model could handle by an order of magnitude. I thought about that pressure as a question of personal sacrifice, of what I would have to give up to meet the deadlines. In my mentally exhausted state, what I did not have space for was the way that same pressure, on the operational side of the company, could be producing the third-party harms the safety case for the technology was supposed to prevent. The race to profitability does not always stay on its own side of the company.

I lent my skills, and pieces of my life that could have gone elsewhere, to an institution whose precariousness was driving choices I either did not see or did not let myself see. Collapsing this into "I was implicated" or "I was not" would be too clean for what I actually felt. I am uncertain how much of the seeing was available to me at the time, but I am certain that with a bit more awareness, I could have seen more. What I should have done is itself unclear to me. Probably raised harder questions earlier about whether the speed we were holding was compatible with the safety case the company was making publicly. Possibly left sooner. The honest answer is I do not know.

What Cruise shifted in me was not a position on self-driving. The technology itself is genuinely complex, even setting aside the specific failures. The case for it is real. There are reasons to think the best autonomous systems may already be safer in their domains than human drivers, on average, and that the 40,000 road fatalities a year in the US (and far more non-fatal accidents) will come to be viewed in time as a policy choice. Fewer drunk drivers, fewer drowsy ones, the possibility of giving a disabled person who cannot drive the freedom to leave their house alone. The case against is also real, and not only in the worst-case sense. There were the traffic backups that cascaded through San Francisco neighborhoods. The labor implications for taxi and rideshare drivers. The way a city became, without quite consenting to it, the test environment for a technology whose third-party costs the city would absorb. The reasonable response is not to land cleanly on one side. It's to keep all of this in view and still say something.

What Cruise shifted in me was something more like the question itself: whether I had been bringing the same intellectual rigor to the moral dimensions of my work that I had been bringing to its technical dimensions. The honest answer was that I had not. The discomfort of that answer is part of what I am holding.

## Three doors and a fourth

Albert Hirschman gave us a vocabulary for what a person does when an institution they care about begins to fail. [*Exit, Voice, and Loyalty*](https://www.hup.harvard.edu/books/9780674276604) is famously elegant: you can leave, you can speak up, or you can hang in there. The taxonomy is clean. The choice is not. Hirschman's actual argument is that the three options interact. Loyalty is what makes voice possible: if you are not going to leave, you have skin in the game to speak up, and your speaking has weight. Easy exit weakens voice, because the dissatisfied just leave instead of fighting. Later scholars added a less honorable fourth: neglect, the staying without engaging, going through motions while withholding the part of yourself that might have made a difference.

I have done all of these in different proportions at different employers, and the proportions did not reliably track the moral stakes. There were periods when I should have exercised more voice and chose a low-engagement form of loyalty instead. There were periods when I exercised voice and was not sure whether it was changing anything. There were exits I chose well and exits I chose late. The framework is useful precisely because it forces the question that the lived experience does not always pose clearly: what am I doing here, right now, with respect to this institution? Am I shaping it, leaving it, deepening my commitment, or pretending to one of these while doing another?

## The structural undervaluing

I worked at Block for the last year or so on the compliance engineering side. The job, as I understood it, was to put friction where the institution would not otherwise put it: to detect and remediate gaps in the program, to track the data that audits depended on, to push for what regulators would eventually insist on whether we volunteered it or not. This was voice work, in Hirschman's vocabulary: pushing from inside for what the institution would not otherwise do. By my own lights, this is among the most defensible work a technologist can do. The regulations my work was responsive to exist to protect society from real harms: money laundering, fraud against vulnerable people, the financial infrastructure of human trafficking.

In practice, much of what I did was instrument compliance: build the systems that would tell us, in close to real time, whether we were meeting our obligations or drifting out of them. The work, in a way, was about extending the company's ability to see itself. The technical work was straightforward. The political work, getting other teams to allocate even a small slice of their roadmap to the instrumentation, was the harder part. The pattern repeated: "we are reworking that system," "now is not a good time," "we will get to it next quarter." Now never arrived. I was getting "this is worth doing" from my management chain and "this is not worth our time" from everyone else.

The public record speaks for itself: [settlements](https://www.csbs.org/newsroom/state-regulators-issue-80-million-penalty-block-inc-cash-app-bsaaml-violations), [consent orders](https://www.consumerfinance.gov/enforcement/actions/block-inc/), substantial penalties.

I am proud of the work I did. I also don't fully understand how an organization committed in principle to financial inclusion produced the regulatory record it did, and I notice the pattern recurs across the industry. The product space rewards speed; the costs of corner-cutting land on people who didn't choose to be in it. Compliance is friction, and friction is structurally under-resourced.

At Cruise I was loyal in the low-engagement way. At Block I tried voice. Both ended in exit. The framework helps me see what I did. The question is what I do with the seeing.

## What I am left with

A way of staying alert at my desk: to what I am building, who it is for, who it is not for, what it makes more possible and what it forecloses. Alert, too, to the gaps in my own seeing.

Going forward, the question of where to lend my skills and my hours is a choice about which institutional orientation I want my work entangled with, and about what shape my response will take if I notice that the orientation does not quite match what I was told: voice, exit, or the loyalty that does not slide into neglect. There is no clean institution. There are ones whose pressures push in directions I can mostly endorse and ones whose pressures don't, and telling the difference is my job.

I have started spending real time on the leadership patterns at the companies I am considering. The questions I want answered, regardless of sector: whether the people inside who raise friction tend to leave in waves; whether pressing the edges of regulation is treated as competitive advantage; whether the political arm exists primarily to lobby against the rules that are obviously coming. These are questions I owe the same rigor I once reserved for the technical kind.

A question I want to keep at my desk: what am I doing here, with respect to this institution? Most days the answer won't be clean. The point is to keep asking.
