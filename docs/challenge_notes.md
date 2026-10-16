Quality of Pitch
- How well you are able to present your story?
- Build a story/user journey?
Technical Development
- Have you considered the edge cases?

Level of Innovation
- Have you thought about the creative use of AI/ML?
- Do you have something that stands out?

Fit to Challenge / Need
- Does it solve the purpose/Non-Profits need
- Make sure the use of AI is well aligned

Submit:
- Executive Summary Presentation (Solution Description, Tech Stack & Architecture)
- Video

2 Social Good Challenges (Non-Profits)
- Autism Partnership
- CatchThemYoung

Document Prompting/LLM Usage

# Challenge 1
CatchThemYoung
- Dealing with children ages 7 to 12
- IPC Charity Organisation (Primary School + Youth from Secondary School)
Goal: Moving students up the social ladder

Methods:
Academic Support
- Lessons

Character Development through Sports
- 

Building Social Capital
- Sports Camp (Connect sports camp with corporate volunteers/tertiary institutions)

Problem: How to analyse test scores?
A test score can hide a children's understanding.
- Cannot read easily
- Short attention span (assessment is too long, record 40 minutes)
- Late signals
- Limited assessment access outside of school (AI Teacher?)
- 2-3 Weeks for marks/assessment to be manually marked by tutors, learning gaps are addressed late

Solution:
- Build an assessment app that can run on iPad (Using Swift)
- Use intuitive UI/less text for mathematics questions to focus solely on those problems
- Teach English separately
- Use dyslexic friendly font?
- Audio so they can listen instead of typing?

Scope:
Mathematics:
- P1: Addition/Subtraction up to 100, Numbers
- P2: Extend number work and operations to 1,000

English:
- P1: Vocabulary, sentence formation and core grammar (Kahoot Style? Duolingo Style)
- P2: More grammar forms and simple comprehension

Needs:
- Simple: Classroom-Ready, little to no training, shared devices
- Inclusive: English only, support children who cannot yet read independtly no sharing or peer comparisons
- Useful: Track progress against the child's own earlier results and show learning by outcome (Marks per section e.g. able to add within 10s, able to add up to 40?)
- Safe: 

Wants:
- Children: Engaged and willing to participate, able to show understanding regardless of reading level, able to stay focused
- CTY: Progress measured by learning outcomes, not only grades, earlier ID of gaps, evidence to decide whether to scale
- Tutors: Immediate results
- Schools: 

Past Beneficiaries:
CHAMPS/KidsExcel+/YouthExcel/See Better Learn Better

How might we create short, gamified assessments that reveal what  each child has mastered, and how they solve problems, in time for educators to act?

Questions to ask:
What have you tried in the past, what did not work?
From your experience what is the average attention span of children now? You mentioned it used to be 40 minutes, how has that changed?

# Challenge 2: Autism Partnership
Autism Partnership Method (APM)
- Intensive behavioural treatment based on Applied Behavioural Analysis (APA)
- Clientele Size 30

Target Audience:
- Children <6yo

Student Journey Overview
- Onboarding
- APM Therapy
- Support & Maintenance

Staff Journey Overview
- Need resource reallocation as staff absences are reported by 7AM
- 30 minutes to make resources
- Coordinate a change

Reallocation is Difficult:
- Complex Matching (Factors: Availability, Capability, Familiarity, Service Requirements)
- Fragmented Information (Comms - WhatsApp, Scheduling - Excel, Staff Knowledge - Personal in Brain)
- Multiple People Affected (Communication: Therapists, Supervisors, Families must receive clear updates)
- Limited Traceability (Limited Traceability: Rules, rationale, approvals notification are not tracked)

Wants:
- Speed
- Transparency
- Coordination
- Insight

Data Background:
- Excel: Schedules/Historical Assignments
- WhatsApp: Urgent coordination & Notifications
- Hirasmus: Session logs & progress visualisations

Data Gaps:
- Familiarity History: Prior working relationships are not reliably structured
- Expertise & Fit: Capability indicators are not consistently captured
- Decision rationale: Matching conditions/relations

General Gist:
- Automatic Scheduling

Key Constraints:
- Time Sensitive
- Privacy & Security
- Service Quality & Continuity

PT/MBT: Junior Cases
MBT/SBT: Senior Cases

What is considered "Senior"?
- Core
- Advanced (Mixed Team of Regular/Senior Therapist, repeated names)
- Specialised

What does the data look like?
- Hirasmus store these data
- Ask their colleague for help via unofficial channels/WhatsApp
- Disorganised

How is ranking considered?
- Hierachy of heuristics is considered
- Replacement is done with the team (Celine & Naughty), therapists that have taught

What is the role of the supervisor?
- Administrator does up the revised schedule
- Replacement is not optimised, supervisor steps in to check
- Case and Team are interchangeable

Edge case:
- What happens when there is no close fit matches?
- Cancellation & refunds (worst case)

How are the schedules made?
- Onboarding process: Understand client profile & child & which therapist is suitable for them
- See which therapist is available
- Does daily therapy, parents will let us know the logistical needs

What are the existing solutions you've tried?
- Tried Claude, keep having to annonymise the names and then 
- Make a WhatsApp bot to work with their existing flows?
- Microsoft Sharepoint site?

Limits to scheduling?
- Child has 1-4 therapists on the team
- Defined by regularity (don't want as much changes in the routine)
- 1 therapist every MWF morning, MWF afternoon, MWF whole-day

Wants:
- Service Delivery (being as empathetic as possible)
- Explain the cause/convey it kindly

What knowledge isn't represented? How do we collect it from the relevant therapists?
- Make a data extraction/survey for their survey experience

Do you have a structure to WhatsApp?
- All employees send admin the messages
- Admin sends revised schedule for information (separate group)

Therapist-Child Pairing:
- Charlie appears in Regular + Senior Therapist Band (Advanced Case Either/Or)
- Paul (Only Senior Therapist)
- Start/End recordings on Hirasmus ()
- Videos are taken (To teach the replacement therapist)
- Audio is taken and stored on Hi Rasmus

What other time wasters are there?
- Feeding claude the scenario X therapist is unavailable
- Might as well does it yourself

Looking for an Agent Solution (Continually improved)

How is the data flow?
- Very informal using WhatsApp
- Accessbility
- Does not prefer Outlook/Teams/other communication channels
- Families want it simple like just a text

Solution Comes to live
- Automatically creates a schedule (Admin then Supervisor Checks)
- Supervisor mentions it could be optimised better, we don't need to cancel, maybe this swap could lead to another swap
- Therapist match first > Optimisation (least cancellations)

Cancellation Message
- Standardised messages to the parents (No template to make it human as possible)
- Do not use this auto-generation

Edge Cases:
- Communicate via WhatsApp
- Mentally tracking parents preferences
- Don't respond by 7:30 (have to call) operational failure, go all the way to their house and the family cancels > Ask therapist to come back to the centre > Schedule another day

Tiers: By payment for therapists

How might you help Autism Partnership design a secure and auditable solution that supports rapid resource reallocation when operational disruptions occur, while maintain service continuity, practical feasibility and timely notification of impacted individuals?