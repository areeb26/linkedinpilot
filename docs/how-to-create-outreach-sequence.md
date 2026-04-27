# How to create an Outreach Sequence

This guide provides best practices for automating your outreach efforts by compiling a list of profiles and sending invitations in bulk on LinkedIn. It also offers strategies to save time during the integration process..

# Origin of the List of Contacts

A typical starting point for an outreach sequence is performing a search on LinkedIn. Users can select profiles they wish to connect with using the standard LinkedIn search or LinkedIn Sales Navigator, applying various filters to refine their search.

Handling the Copy-Pasted URL of Your Search Results :

* Utilize the  [Linkedin Search endpoint](https://developer.unipile.com/docs/linkedin-search) to fetch the search results of your users. Handle direct copy/paste URLs from your users or implement parameter selection in your UI.
* Implement a pagination cursor to gather all result pages, spacing your requests to mimic human activity.
* To compile a list of results or connections, it is recommended to manage a maximum of 1,000 profiles per day (or 2,500 for Sales Navigator accounts), spreading them across several attempts during working hours. For further information, consult the[ LinkedIn limitations](https://developer.unipile.com/docs/provider-limits-and-restrictions). Given the 200 invitations you can send per week, it is unnecessary to accelerate and gather thousands of profiles in a single day.
* Analyze the results and store the data for the next steps.

# Planning Your Sequence

After compiling your list of contacts, schedule the outreach over time, taking into account LinkedIn's limitations on connection requests: 80 to 100 per account per day (with a maximum of 200 per week) and profile visits: 80 to 100 (Premium) or up to 150 (Sales Navigator) per account per day.

For instance, to contact 1,000 profiles, you will need approximately 5 weeks.

It's advisable to distribute the invitations on working days, sending 30 to 50 invitations daily at random intervals.

Manage concurrent sequences carefully; if a user initiates two sequences simultaneously, you should pause the first one or adjust the numbers to adhere to limitations.

The profile retrieval limit is crucial, as it is needed to convert the public provider IDs you've collected into private IDs for sending invitations. This action should be performed shortly before dispatching them throughout the day.

Store all generated slots in your database.

# Sending

When your system reaches a sending slot:

[Retrieve the user's profile](https://developer.unipile.com/reference/userscontroller_getprofilebyidentifier) to convert the ID, check the relationship status, and personalize your message with the profile data.\
Depending on the relationship status, [send an invitation, ](https://developer.unipile.com/docs/invite-users#example-of-inviting-someone-on-linkedin)[an InMail, or a standard message.](https://developer.unipile.com/reference/chatscontroller_startnewchat)

# Handling Errors in API Responses

It's important to manage errors in the responses from your API calls. For example, if your users send out invitations at the same time, your call could be rejected due to hitting LinkedIn's limitations. In such cases, you need to reschedule your sequence for the following weeks and inform your users accordingly.

# Go further

To increase prospecting volumes and not be capped at the limit of 200 invitations per week, you can incorporate email management into your sequence.
