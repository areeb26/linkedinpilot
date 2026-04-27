# Perform API Linkedin search and export result

You have the ability to make search on Classic, Sales Navigator or Recruiter to get People, Companies, Jobs or Posts list result with same criteria of LinkedIn interface on behalf of each account depending LinkedIn subscription.

That can be useful to extract list of person to start outreach sequence on your target, export list of companies in specific sector, location or other criteria, search for LinkedIn profile of someone with his name and company, list mutual relation with someone to ask warm intro, search for open profile in sales navigator, advanced candidate search in recruiter, search for posts contain specific keywords, and many other use case you can do manually on LinkedIn search can be automated.

We propose two ways to perform search, you can copy past URL of search directly from your browser or you can construct parameters value on your app and send a request with all parameters value in your Unipile query.

Here are some examples, but you can find the endpoint documentation with all parameters details here: [Get Linkedin Search Parameters API](https://developer.unipile.com/reference/linkedincontroller_getsearchparameterslist) & [Perform a Linkedin Search API](https://developer.unipile.com/reference/linkedincontroller_search)

Please have a look on [Linkedin limitations ](https://developer.unipile.com/docs/provider-limits-and-restrictions) about this endpoint.

# Perform a search from copy/past URL

You can copy paste URL from any search result, saved search or list of leads

```Text text
curl --request POST \
     --url https://{YOUR_DSN}/api/v1/linkedin/search?account_id=!!YOURACCOUNTID!!
     --header 'X-API-KEY: XXXX' \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --data '
{
	"url": "https://www.linkedin.com/sales/search/people?query=(recentSearchParam%3A(id%3A3623570490%2CdoLogHistory%3Atrue)%2Cfilters%3AList((type%3AFUNCTION%2Cvalues%3AList((id%3A3%2Ctext%3AArts%2520and%2520Design%2CselectionType%3AINCLUDED)%2C(id%3A6%2Ctext%3AConsulting%2CselectionType%3AEXCLUDED)))%2C(type%3ACOMPANY_TYPE%2Cvalues%3AList((id%3AC%2Ctext%3APublic%2520Company%2CselectionType%3AINCLUDED)))))&sessionId=SsMfcb5pSmeVeTNnPOPxaw%3D%3D&viewAllFilters=true"
}
'
```

# Perform a search on basic fixed value parameters

Example for search people on sales navigator with overall seniority from 5 years and English profile language

```curl
curl --request POST \
     --url https://{YOUR_DSN}/api/v1/linkedin/search?account_id=!!YOURACCOUNTID!!
     --header 'X-API-KEY: XXXX' \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --data '
{
	"api": "sales_navigator",
	"category": "people",
	"keywords": "developer",
	"tenure": [{ "min": 3  }],
	"profile_language": ["en"]
}
'
```

# Perform a search on parameters needed to loading their id before performing a search

Example for classic search to retrieve companies that have job offers, and located in areas affected by “location” IDs

## 1 - Search for location IDs with parameters that match your text location

```curl
curl --request GET \
     --url https://{YOUR_DSN}/api/v1/linkedin/search/parameters?account_id=!YOURACCOUNTID!!&type=LOCATION&keywords=los%20angeles&limit=100
     --header 'X-API-KEY: XXXX' \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
```

## 2 - Use this ID to perform the search

Example for search companies on classic who has job offers in two specific locations

```curl curl
curl --request POST \
     --url https://{YOUR_DSN}/api/v1/linkedin/search?account_id=!!YOURACCOUNTID!!
     --header 'X-API-KEY: XXXX' \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --data '
{
	"api": "classic",
	"category": "companies",
	"has_job_offers": true,
	"location": [102277331, 102448103]
}
'
```

Example  for search people on recruiter whose role should be either developer OR engineer, whose skills should include "50517" (Typescript skill ID) and exclude "261" (Php skill ID), whose industry include "4" (Software Development industry ID) and who are first, second, or third degree connections.

```curl curl
curl --request POST \
     --url https://{YOUR_DSN}/api/v1/linkedin/search?account_id=!!YOURACCOUNTID!!
     --header 'X-API-KEY: XXXX' \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --data '
{
	"api": "recruiter",
	"category": "people",
	"network_distance": [1, 2, 3],
	"industry": {
		"include": ["4"]
	},
	"role": [
		{
		  "keywords": "developer OR engineer",
		  "priority": "MUST_HAVE",
		  "scope": "CURRENT_OR_PAST"
		}
	],
	"skills": [
		{
			"id": "261",
			"priority": "DOESNT_HAVE"
		},
				{
			"id": "50517",
			"priority": "MUST_HAVE"
		}
	]
}'
```

# Examples of results

## Parameter search

```json json
{
	"object": "LinkedinSearchParametersList",
	"items": [
		{
			"object": "LinkedinSearchParameter",
			"title": "Technology, Information and Internet",
			"id": "6"
		},
		{
			"object": "LinkedinSearchParameter",
			"title": "Climate Technology Product Manufacturing",
			"id": "3251"
		},
		{
			"object": "LinkedinSearchParameter",
			"title": "Space Research and Technology",
			"id": "3089"
		},
		{
			"object": "LinkedinSearchParameter",
			"title": "Technical and Vocational Training",
			"id": "2018"
		},
		{
			"object": "LinkedinSearchParameter",
			"title": "Technology, Information and Media",
			"id": "1594"
		}
	],
	"paging": {
		"page_count": 5
	}
}
```

## Search for Companies on Sales Navigator

```json
{
	"object": "LinkedinSearch",
	"items": [
		{
			"type": "COMPANY",
			"id": "103848457",
			"name": "Softwares For MLM",
			"profile_url": "https://www.linkedin.com/sales/company/103848457",
			"summary": "SFM (SoftwaresForMLM.com) specializes in delivering cutting-edge MLM software solutions designed to empower direct-selling businesses. With over 9 years of industry experience and a dedicated team of professionals, we have catered to over 1000+ satisfied customers, helping them achieve their business objectives. Our comprehensive software features help you ensure seamless operations and enhanced efficiency.  Ready to change the game and take your business to new heights? Connect with us on LinkedIn to stay updated on industry trends and insights!",
			"industry": "Software Development",
			"location": null,
			"headcount": "0"
		},
		{
			"type": "COMPANY",
			"id": "791056",
			"name": "Union Softwares | QuintoAndar",
			"profile_url": "https://www.linkedin.com/sales/company/791056",
			"summary": "Especialista em Imobiliárias\r\n\r\nNossa história de crescimento associa-se diretamente ao franco crescimento do mercado imobiliário. A empresa respondeu à altura quanto à qualidade dos produtos e serviços para esse segmento.\r\n\r\nDesde 1995 atende todo Brasil. Nossos serviços compreendem desenvolvimento de softwares, aplicativos, sites (para imobiliárias, corretores de imóveis e redes imobiliárias), portais e comunicação entre redes imobiliárias.\r\n\r\nEmpresa expandiu também em eficiência de atendimento, desenvolvendo modelos e rotinas para melhor gerir as dúvidas dos clientes. Nosso objetivo é orientar com brevidade e precisão, o que faz da equipe uma das mais eficientes existentes no mercado.\r\n\r\nTodo o quadro de colaboradores da Union – Especialista em Soluções Imobiliárias é constantemente treinado e capacitado, com postura autocrítica em relação ao cumprimento de suas funções, garantindo a todos os clientes o mesmo alto padrão de atendimento.\r\n\r\nSoluções imobiliárias: é o que melhor fazemos.\r\n\r\nConheça nosso site: www.uso.com.br\r\n\r\nUma empresa do Grupo QuintoAndar: www.quintoandar.com.br",
			"industry": "Software Development",
			"location": null,
			"headcount": "54"
		},
		{
			"type": "COMPANY",
			"id": "957117",
			"name": "totalCAD Softwares Técnicos",
			"profile_url": "https://www.linkedin.com/sales/company/957117",
			"summary": "A totalCAD é distribuidora especializada em softwares técnicos para projetos de CAD/CAE atendendo o mercado de engenharia, arquitetura e projetos industriais.\n\nAo longo dos anos, a totalCAD ampliou sua abrangência de serviços para este mercado e conta com uma sólida estrutura voltada para treinamentos (presenciais e por e-learning), palestras, certificação em CAD, desenvolvimento de aplicativos, cursos patrocinados, road shows e outros.\n\nDistribuidor exclusivo: ZWCAD",
			"industry": "Software Development",
			"location": null,
			"headcount": "80"
		},
		{
			"type": "COMPANY",
			"id": "3193089",
			"name": "Sisloc Softwares",
			"profile_url": "https://www.linkedin.com/sales/company/3193089",
			"summary": "A Sisloc é a solução mais completa para gestão de locadoras de bens móveis do Brasil. São diversos módulos desenvolvidos especialmente para atender à necessidade do setor de locação. Atendemos locadoras de todos os portes e grupos de equipamentos, de Norte a Sul do Brasil.\n\n\nSisloc é muito mais do que ter apenas um software de gestão para locadoras, é ter o conhecimento e a garantia de quem atua exclusivamente no segmento há mais de 32 anos, estudando cada detalhe das operações e os desafios dos profissionais da área.\n\nAtualmente, são mais de 1.000 locadoras e 8.000 usuários que confiam na tecnologia da Sisloc para fazer a sua gestão. ",
			"industry": "Software Development",
			"location": null,
			"headcount": "152"
		},
		{
			"type": "COMPANY",
			"id": "27326223",
			"name": "HUBCITY SOFTWARES PRIVATE LIMITED",
			"profile_url": "https://www.linkedin.com/sales/company/27326223",
			"summary": "The Hubcity Softwares group has been providing professional services to small businesses all the way up to blue chip companies, since 2006. We have constantly gained reputation for excellent project management and large-scale commercial infrastructure projects. Always focusing on timely and professional project delivery, we became a respected name amongst large companies. Today, we provide Infrastructure services, IT and Office Management tools.",
			"industry": "Software Development",
			"location": null,
			"headcount": "17"
		}
	],
	"config": {
		"params": {
			"api": "sales_navigator",
			"category": "companies",
			"keywords": "softwares",
			"industry": {
				"include": [
					6
				]
			}
		}
	},
	"paging": {
		"start": 0,
		"page_count": 5,
		"total_count": 4886
	},
	"cursor": "eyJhY2NvdW50X2lkIjoiOFJma0txU0tSTy1JbXpKT2k4T1I1USIsImxpbWl0Ijo1LCJzdGFydCI6NSwicGFyYW1zIjp7ImFwaSI6InNhbGVzX25hdmlnYXRvciIsImNhdGVnb3J5IjoiY29tcGFuaWVzIiwia2V5d29yZHMiOiJzb2Z0d2FyZXMiLCJpbmR1c3RyeSI6eyJpbmNsdWRlIjpbNl19fX0="
}
```

## Search for People on  Sales Navigator

```json
{
	"object": "LinkedinSearch",
	"items": [
    {
			"type": "PEOPLE",
			"id": "ACwAAASNCJcBS2NERCgi0j_f7_oYqCSbTGsNYBc",
			"industry": null,
			"name": "Luciano Bana",
			"first_name": "Luciano",
			"last_name": "Bana",
			"member_urn": "urn:li:member:76351639",
			"public_identifier": "luciano-bana-b876a021",
			"public_profile_url": "https://www.linkedin.com/in/luciano-bana-b876a021",
			"profile_url": "https://www.linkedin.com/sales/lead/ACwAAASNCJcBS2NERCgi0j_f7_oYqCSbTGsNYBc,NAME_SEARCH,NqOz",
			"profile_picture_url": "https://media.licdn.com/dms/image/v2/C4E03AQF_CASx9NFJ0A/profile-displayphoto-shrink_100_100/profile-displayphoto-shrink_100_100/0/1595802673106?e=1730332800&v=beta&t=ApvY9fhCIU9Vw2-sMStegG0HzslsyPUfX412zRWvf-M",
			"network_distance": "DISTANCE_3",
			"location": "United States",
			"headline": "Building relationships one Hi-rise at a time\n\nThroughout my career, I have earned industry recognition as a sought out professional in residential and commercial developments, bridging cross-functional teams and forging partnerships with key business decision makers.\n\nMy only endeavor is to continue my success in a business that I love",
			"pending_invitation": false,
			"premium": true,
			"open_profile": true,
			"current_positions": [
				{
					"company": "Hudson Meridian Construction Group",
					"company_id": null,
					"description": "Overall P&L for the execution and success of each project assigned.",
					"location": null,
					"role": "Sr Vice President of Construction",
					"tenure_at_company": {
						"years": 10
					},
					"tenure_at_role": {
						"years": 10
					}
				}
			]
		},
	],
	"config": {
		"params": {
			"api": "sales_navigator",
			"category": "people",
			"keywords": "sales",
			"company": {
				"include": [
					1441
				],
				"exclude": [
					1035
				]
			}
		}
	},
	"paging": {
		"start": 0,
		"page_count": 5,
		"total_count": 25438
	},
	"cursor": "eyJhY2NvdW50X2lkIjoiOFJma0txU0tSTy1JbXpKT2k4T1I1USIsImxpbWl0Ijo1LCJzdGFydCI6NSwicGFyYW1zIjp7ImFwaSI6InNhbGVzX25hdmlnYXRvciIsImNhdGVnb3J5IjoicGVvcGxlIiwia2V5d29yZHMiOiJzYWxlcyIsImNvbXBhbnkiOnsiaW5jbHVkZSI6WzE0NDFdLCJleGNsdWRlIjpbMTAzNV19fX0="
}
```

## Search for People on Classic

```json
{
	"object": "LinkedinSearch",
	"items": [
		{
			"type": "PEOPLE",
			"id": "ACoAAAdHsOUBYtAunOfY0wJIbiwgewolov5X55M",
			"name": "Piyush Narwani",
			"member_urn": "urn:li:member:122138853",
			"profile_url": "https://www.linkedin.com/in/piyushnarwani?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAAdHsOUBYtAunOfY0wJIbiwgewolov5X55M",
			"network_distance": "DISTANCE_2",
			"location": "San Francisco, CA",
			"headline": "Co-Founder, Aerotime (YC W21)"
		},
		{
			"type": "PEOPLE",
			"id": "ACoAACxgkaYBcqySPzUbuxjwSVmdsh6v0LR5QLI",
			"name": "Kamil Debbagh",
			"member_urn": "urn:li:member:744526246",
			"profile_url": "https://www.linkedin.com/in/kamil-debbagh?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAACxgkaYBcqySPzUbuxjwSVmdsh6v0LR5QLI",
			"network_distance": "DISTANCE_2",
			"location": "San Francisco, CA",
			"headline": "Our AI lets app marketers create performing video ads in seconds"
		},
		{
			"type": "PEOPLE",
			"id": "ACoAABjusvEB-KGzd61sw_OGEG8seOgWAy72NiQ",
			"name": "Arshia Moghaddam",
			"member_urn": "urn:li:member:418296561",
			"profile_url": "https://www.linkedin.com/in/arshiamog?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAABjusvEB-KGzd61sw_OGEG8seOgWAy72NiQ",
			"network_distance": "DISTANCE_2",
			"location": "San Francisco, CA",
			"headline": "Product Manager"
		},
		{
			"type": "PEOPLE",
			"id": "ACoAABkq1NQBjkF99AF1GVREtVA2opIGjuWXFE4",
			"name": "J.Y Delmotte",
			"member_urn": "urn:li:member:422237396",
			"profile_url": "https://www.linkedin.com/in/jeanyves-delmotte?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAABkq1NQBjkF99AF1GVREtVA2opIGjuWXFE4",
			"network_distance": "DISTANCE_2",
			"location": "San Francisco, CA",
			"headline": "Co-founder @ BuddiesHR.com // 5x Startup Founder // YC alum"
		},
		{
			"type": "PEOPLE",
			"id": "ACoAAAyPQZYBchkYpyN0NILTInIOyXtixhzkKc4",
			"name": "Roy N.",
			"member_urn": "urn:li:member:210715030",
			"profile_url": "https://www.linkedin.com/in/roynicolet?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAAyPQZYBchkYpyN0NILTInIOyXtixhzkKc4",
			"network_distance": "DISTANCE_2",
			"location": "San Francisco, CA",
			"headline": "Roy Nicolet"
		},
		{
			"type": "PEOPLE",
			"id": "ACoAABcW0cMBeN3FC62yRA3-qG90SMqkP4x67So",
			"name": "Nick Fiacco",
			"member_urn": "urn:li:member:387371459",
			"profile_url": "https://www.linkedin.com/in/nfiacco?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAABcW0cMBeN3FC62yRA3-qG90SMqkP4x67So",
			"network_distance": "DISTANCE_2",
			"location": "San Francisco, CA",
			"headline": "Co-Founder at Demospace (YC W23)"
		},
		{
			"type": "PEOPLE",
			"id": "ACoAABT_1jMBUFFpMOvZAwTn9srI5NfD-buVuJA",
			"name": "Catherine Wu",
			"member_urn": "urn:li:member:352310835",
			"profile_url": "https://www.linkedin.com/in/cat-wu?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAABT_1jMBUFFpMOvZAwTn9srI5NfD-buVuJA",
			"network_distance": "DISTANCE_2",
			"location": "San Francisco, CA",
			"headline": "Partner at Index Ventures"
		},
		{
			"type": "PEOPLE",
			"id": "ACoAACfpuM8BuYJ5kBZTX7uNkrh7NPUUBmRv4Yo",
			"name": "Brandon Tull",
			"member_urn": "urn:li:member:669628623",
			"profile_url": "https://www.linkedin.com/in/brandon-tull?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAACfpuM8BuYJ5kBZTX7uNkrh7NPUUBmRv4Yo",
			"network_distance": "DISTANCE_2",
			"location": "San Francisco Bay Area",
			"headline": "Account Manager at Square"
		},
		{
			"type": "PEOPLE",
			"id": "ACoAACBd-w8BiPlNIddmVWyVhUL1bL0MdIYpyow",
			"name": "Ellen Lucia Sirekanian",
			"member_urn": "urn:li:member:543030031",
			"profile_url": "https://www.linkedin.com/in/ellen-lucia-sirekanian-5a7a39131?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAACBd-w8BiPlNIddmVWyVhUL1bL0MdIYpyow",
			"network_distance": "DISTANCE_2",
			"location": "Los Angeles, CA",
			"headline": "Director Of Revenue Operations @autone"
		},
		{
			"type": "PEOPLE",
			"id": "ACoAACdYQiYBqetYYZ0vv5f2p34QuHdICin9xQE",
			"name": "Nkululeko Mhlongo",
			"member_urn": "urn:li:member:660095526",
			"profile_url": "https://www.linkedin.com/in/nkululeko-mhlongo-886093165?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAACdYQiYBqetYYZ0vv5f2p34QuHdICin9xQE",
			"network_distance": "DISTANCE_2",
			"location": "United States",
			"headline": "Business Strategy | Ex-BCG | Allan Gray Fellow"
		}
	],
	"config": {
		"params": {
			"api": "classic",
			"category": "people",
			"location": [
				102277331,
				102448103
			]
		}
	},
	"paging": {
		"start": 0,
		"page_count": 10,
		"total_count": 1000
	},
	"cursor": "eyJhY2NvdW50X2lkIjoiOFJma0txU0tSTy1JbXpKT2k4T1I1USIsImxpbWl0IjoxMCwic3RhcnQiOjEwLCJwYXJhbXMiOnsiYXBpIjoiY2xhc3NpYyIsImNhdGVnb3J5IjoicGVvcGxlIiwibG9jYXRpb24iOlsxMDIyNzczMzEsMTAyNDQ4MTAzXX19"
}
```

## Search for Companies on Classic

```json json
{
	"object": "LinkedinSearch",
	"items": [
		{
			"type": "COMPANY",
			"id": "165158",
			"name": "Netflix",
			"profile_url": "https://www.linkedin.com/company/netflix/",
			"summary": "Where you come to do the best work of your life. Follow @Netflix on Twitter, Instagram, TikTok and Youtube for more",
			"industry": "Entertainment Providers",
			"location": "Los Gatos, CA",
			"followers_count": 11000000,
			"job_offers_count": 427
		},
		{
			"type": "COMPANY",
			"id": "1480",
			"name": "Adobe",
			"profile_url": "https://www.linkedin.com/company/adobe/",
			"summary": "Changing the world through digital experiences.",
			"industry": "Software Development",
			"location": "San Jose, CA",
			"followers_count": 5000000,
			"job_offers_count": 2
		},
		{
			"type": "COMPANY",
			"id": "1586",
			"name": "Amazon",
			"profile_url": "https://www.linkedin.com/company/amazon/",
			"summary": null,
			"industry": "Software Development",
			"location": "Seattle, WA",
			"followers_count": 32000000,
			"job_offers_count": 9
		},
		{
			"type": "COMPANY",
			"id": "3650502",
			"name": "Figma",
			"profile_url": "https://www.linkedin.com/company/figma/",
			"summary": "Meet us at Moscone, June 26-27.",
			"industry": "Design Services",
			"location": "San Francisco, California",
			"followers_count": 1000000,
			"job_offers_count": 1
		},
		{
			"type": "COMPANY",
			"id": "1612748",
			"name": "Slack",
			"profile_url": "https://www.linkedin.com/company/tiny-spec-inc/",
			"summary": null,
			"industry": "Technology, Information and Internet",
			"location": "San Francisco, California",
			"followers_count": 2000000,
			"job_offers_count": 1
		},
		{
			"type": "COMPANY",
			"id": "167251",
			"name": "Dropbox",
			"profile_url": "https://www.linkedin.com/company/dropbox/",
			"summary": "Dropbox is the one place to keep life organized and keep work moving.",
			"industry": "Software Development",
			"location": "San Francisco, California",
			"followers_count": 458000,
			"job_offers_count": 54
		},
		{
			"type": "COMPANY",
			"id": "807257",
			"name": "Asana",
			"profile_url": "https://www.linkedin.com/company/asana/",
			"summary": "The #1 AI work management platform",
			"industry": "Software Development",
			"location": "San Francisco, California",
			"followers_count": 432000,
			"job_offers_count": 1
		},
		{
			"type": "COMPANY",
			"id": "1009",
			"name": "IBM",
			"profile_url": "https://www.linkedin.com/company/ibm/",
			"summary": null,
			"industry": "IT Services and IT Consulting",
			"location": "Armonk, New York, NY",
			"followers_count": 17000000,
			"job_offers_count": 6
		},
		{
			"type": "COMPANY",
			"id": "1441",
			"name": "Google",
			"profile_url": "https://www.linkedin.com/company/google/",
			"summary": null,
			"industry": "Software Development",
			"location": "Mountain View, CA",
			"followers_count": 34000000,
			"job_offers_count": 12
		},
		{
			"type": "COMPANY",
			"id": "1063",
			"name": "Cisco",
			"profile_url": "https://www.linkedin.com/company/cisco/",
			"summary": null,
			"industry": "Software Development",
			"location": "San Jose, CA",
			"followers_count": 7000000,
			"job_offers_count": 2
		}
	],
	"config": {
		"params": {
			"api": "classic",
			"category": "companies",
			"has_job_offers": true,
			"location": [
				102277331,
				102448103
			]
		}
	},
	"paging": {
		"start": 0,
		"page_count": 10,
		"total_count": 1000
	},
	"cursor": "eyJhY2NvdW50X2lkIjoiOFJma0txU0tSTy1JbXpKT2k4T1I1USIsImxpbWl0IjoxMCwic3RhcnQiOjEwLCJwYXJhbXMiOnsiYXBpIjoiY2xhc3NpYyIsImNhdGVnb3J5IjoiY29tcGFuaWVzIiwiaGFzX2pvYl9vZmZlcnMiOnRydWUsImxvY2F0aW9uIjpbMTAyMjc3MzMxLDEwMjQ0ODEwM119fQ=="
}
```

## Search for People on Recruiter

```json
{
	"object": "LinkedinSearch",
	"items": [
		{
			"type": "PEOPLE",
			"id": "AEMAAAQMevMBKmy0KNdlNZA1bV_xR06DjBJ47bY",
			"headline": "Software Engineer at LinkedIn",
			"location": "New York, New York, United States",
			"member_urn": null,
			"network_distance": "OUT_OF_NETWORK",
			"can_send_inmail": true,
			"recruiter_candidate_id": "67926771",
			"name": null,
			"public_identifier": null,
			"public_profile_url": null,
			"profile_url": null,
			"profile_picture_url": null,
			"industry": null,
			"current_positions": [
				{
					"company": "LinkedIn",
					"company_id": "1337",
					"description": "Sponsored Content",
					"location": null,
					"role": "Software Engineer",
					"start": {
						"month": 4,
						"year": 2019
					}
				}
			]
		},
		{
			"type": "PEOPLE",
			"id": "AEMAABvbttcBIYQi6vtvYIzu9Ni0tJ3Op4NGub4",
			"headline": "Senior Software Engineer | JavaScript, Typescript, React.js, Node.js, NestJS | Python, Django | AWS",
			"location": "Cary, North Carolina, United States",
			"member_urn": null,
			"network_distance": "OUT_OF_NETWORK",
			"can_send_inmail": true,
			"recruiter_candidate_id": "467384023",
			"name": null,
			"public_identifier": null,
			"public_profile_url": null,
			"profile_url": null,
			"profile_picture_url": null,
			"industry": null,
			"current_positions": [
				{
					"company": "VeliTech",
					"company_id": "95675813",
					"description": "Hoziron project.\n- Developed services for new market core processes, leading to a successful expansion into a new regional market.\n- Reduced heavyweight request response time by 1.3x using gRPC streams.\n- Enhanced service capacity by 5% through core service refactoring.\n- Collaborated on scalable software solutions with cross-functional teams, improving overall project delivery timelines by 10%.\n- Created and supported over 10 services.\n\n\nTrac project (https://trac.co/)\n- Revamped data storage methods, enhancing reliability and fault tolerance, resulting in a 15% reduction in data-related incidents.\n- Optimized Stripe interaction, enabling accurate payment processing with tax calculations, reducing payment errors by 10%.\n- Upgraded third-party API integration resilience by 30%.\n- Integrated 40+ AWS Step Functions for efficient workflows.\n- Increased artist page loading speed by 15%.",
					"location": "Cary, North Carolina, United States",
					"role": "Senior Software Engineer",
					"start": {
						"month": 3,
						"year": 2022
					}
				}
			]
		},
		{
			"type": "PEOPLE",
			"id": "AEMAABAVPdUBfG7q99GG0iC5YbC8zjFFb1iwFhM",
			"headline": "Senior Software Engineer at Intuit",
			"location": "Bengaluru, Karnataka, India",
			"member_urn": null,
			"network_distance": "OUT_OF_NETWORK",
			"can_send_inmail": true,
			"recruiter_candidate_id": "269827541",
			"name": null,
			"public_identifier": null,
			"public_profile_url": null,
			"profile_url": null,
			"profile_picture_url": null,
			"industry": null,
			"current_positions": [
				{
					"company": "Intuit",
					"company_id": "1666",
					"description": "Recurring Tasks Feature on Back-end in QBO\n- Designed and Built the Recurring Tasks Feature to generate multiple tasks with customizable recurrence in Java SpringBoot\n- Also Built Migration Strategy to Modernize this feature via Runtime Sync, One Time and Real-time Data  migration.\n\nTXP migration for QBO Advanced on UI\n- Lead the TXP migration for QBO advanced Invoice page (Dojo to React.js migration)\n- Collaborated with 8+ teams to align multiple features a with new architecture on the new TXP page\n- Drove the complete rollout end to end to ensure smooth transition to TXP invoice page\n\nSmart suggestions Feature for TXP on UI\n- Re-architected the AI powered Smart Suggestions feature on fronted for improved modularity and re-usability and simpler integration.\n- Lead the complete initiative and released the final product with high code quality.\n- Also improved the accessibility for power keyboard users\n\nQBO Backup and Restore App (https://qbo-backup.app.intuit.com)\n - Lead the initiative for a new User experience for the Company Restore flow.\n - Worked closely with Product and Dev Managers, Designers and Junior developers to streamline the overall Effort.\n- Also built the first phase of the new experience from Scratch.\n- Also improved the system efficiency for processing offline jobs with better cron management and computed scheduling.",
					"location": "Bengaluru, Karnataka, India",
					"role": "Senior Software Engineer",
					"start": {
						"month": 2,
						"year": 2022
					}
				}
			]
		}
	],
	"config": {
		"params": {
			"api": "recruiter",
			"category": "people",
			"network_distance": [
				1,
				2,
				3
			],
			"industry": {
				"include": [
					"4"
				]
			},
			"role": [
				{
					"keywords": "developer OR engineer",
					"priority": "MUST_HAVE",
					"scope": "CURRENT_OR_PAST"
				}
			],
			"skills": [
				{
					"id": "261",
					"priority": "DOESNT_HAVE"
				},
				{
					"id": "50517",
					"priority": "MUST_HAVE"
				}
			]
		}
	},
	"paging": {
		"start": 0,
		"page_count": 3,
		"total_count": 4433432
	},
	"cursor": "eyJhY2NvdW50X2lkIjoiOXE3bDFVZExUZGkwcEFod2xPUEVNdyIsImxpbWl0IjozLCJzdGFydCI6MywicGFyYW1zIjp7ImFwaSI6InJlY3J1aXRlciIsImNhdGVnb3J5IjoicGVvcGxlIiwibmV0d29ya19kaXN0YW5jZSI6WzEsMiwzLCJHUk9VUCJdLCJpbmR1c3RyeSI6eyJpbmNsdWRlIjpbIjQiXX0sInJvbGUiOlt7ImtleXdvcmRzIjoiZGV2ZWxvcGVyIE9SIGVuZ2luZWVyIiwicHJpb3JpdHkiOiJNVVNUX0hBVkUiLCJzY29wZSI6IkNVUlJFTlRfT1JfUEFTVCJ9XSwic2tpbGxzIjpbeyJpZCI6IjI2MSIsInByaW9yaXR5IjoiRE9FU05UX0hBVkUifSx7ImlkIjoiNTA1MTciLCJwcmlvcml0eSI6Ik1VU1RfSEFWRSJ9XX19"
}
```

## Search for Posts on Classic

```curl
{
	"object": "LinkedinSearch",
	"items": [
		{
			"type": "POST",
			"provider": "LINKEDIN",
			"social_id": "urn:li:activity:7236734771807019010",
			"share_url": "https://www.linkedin.com/posts/beau-atkins-105a273b_top-ten-tuesday-essential-reads-for-activity-7236734771807019010-3qVO?utm_source=combined_share_message&utm_medium=member_desktop",
			"date": "1h",
			"parsed_datetime": "2024-09-03T14:02:20.213Z",
			"comment_counter": 2,
			"impressions_counter": 0,
			"reaction_counter": 2,
			"repost_counter": 0,
			"permissions": {
				"can_post_comments": true,
				"can_react": true,
				"can_share": true
			},
			"text": "📕 📖 Top Ten Tuesday: Essential Reads for Finding Presence 📚 🤓 \n\nOver the past few years, I've found several books that have helped me become more present—something I strongly recommend to anyone experiencing family changes like separation or divorce, one of life's toughest challenges. These are my top 10 recommendations for anyone facing tough times or simply wanting to be more present:\n\nPresence by Amy Cuddy\nCuddy shows how being fully present in high-pressure situations helps bring our boldest, most authentic selves forward, boosting confidence and resilience. Her TedTalk is also a must-watch!\n\nThe Last Lecture by Randy Pausch\nThis memoir teaches us to cherish every moment as Pausch reflects on life's preciousness while facing terminal illness. It's hard not to get emotional with this one.\n\nThe Obstacle is the Way by Ryan Holiday   \nHoliday's modern Stoic philosophy encourages us to embrace challenges and stay grounded in the present. His "Daily Stoic" is another favorite of mine.\n\nFlow: The Psychology of Optimal Experience by Mihaly Csikszentmihalyi\nCsikszentmihalyi explores the "flow" state—where time fades and we're fully immersed. His insights have helped me find focus amid the noise.\n\nDeep Work by Cal Newport\nNewport advocates for deep, focused work by being present and eliminating distractions. His strategies have significantly boosted my productivity.\n\nThe Monk Who Sold His Ferrari by Robin Sharma\nSharma's story of a lawyer-turned-monk highlights living in the moment and finding joy in life's simple pleasures—a story that really resonated with me.\n\nWherever You Go, There You Are by Jon Kabat-Zinn\nKabat-Zinn introduces mindfulness, making it a great read for those, like me, who struggle with meditation.\n\nThe Power of Now by Eckhart Tolle\nTolle stresses the importance of living in the present as the path to peace and enlightenment, even though it was a challenging read for me initially.\n\nFour Thousand Weeks by Oliver Burkeman \nBurkeman's book reminds us of life's finite nature, urging us to make the most of every moment. It's humbling and highlights the value of time.\n\nShine by Gino Wickman  and Rob Dube\nThough aimed at entrepreneurs, this book's insights on looking inward and being present are universally applicable in many aspects of life.\n\nThese books offer invaluable guidance on being more present, no matter the challenges you face.",
			"attachments": [
				{
					"id": "D5622AQGhe9HN1jjc5A",
					"sticker": false,
					"size": {
						"height": 1536,
						"width": 1152
					},
					"unavailable": false,
					"type": "img",
					"url": "https://media.licdn.com/dms/image/v2/D5622AQGhe9HN1jjc5A/feedshare-shrink_2048_1536/feedshare-shrink_2048_1536/0/1725108290180?e=1728518400&v=beta&t=w2hJPJ6x5nMzls23wJsUKjx1TyrtfmuK50pjmutjLwo"
				}
			],
			"author": {
				"public_identifier": "beau-atkins-105a273b",
				"name": "Beau Atkins",
				"is_company": false,
				"headline": "CEO at Evolve Family Law"
			},
			"is_repost": false,
			"id": "7236734771807019010"
		},
		{
			"type": "POST",
			"provider": "LINKEDIN",
			"social_id": "urn:li:activity:7236721657753600002",
			"share_url": "https://www.linkedin.com/posts/ginagardinerassociates_%F0%9D%97%9Cm-%F0%9D%97%B2%F0%9D%98%85%F0%9D%97%B0%F0%9D%97%B6%F0%9D%98%81%F0%9D%97%B2%F0%9D%97%B1-%F0%9D%98%81%F0%9D%97%BC-%F0%9D%98%80%F0%9D%97%B5%F0%9D%97%AE%F0%9D%97%BF%F0%9D%97%B2-%F0%9D%97%BC%F0%9D%98%82%F0%9D%97%BF-activity-7236721657753600002-fK2_?utm_source=combined_share_message&utm_medium=member_desktop",
			"date": "1h",
			"parsed_datetime": "2024-09-03T14:02:20.214Z",
			"comment_counter": 0,
			"impressions_counter": 0,
			"reaction_counter": 1,
			"repost_counter": 0,
			"permissions": {
				"can_post_comments": true,
				"can_react": true,
				"can_share": true
			},
			"text": "𝗜'm 𝗲𝘅𝗰𝗶𝘁𝗲𝗱 𝘁𝗼 𝘀𝗵𝗮𝗿𝗲 𝗼𝘂𝗿 𝟭𝘀𝘁 𝗱𝗮𝘆 𝗼𝗳 𝘁𝗵𝗲 𝗦𝗽𝗶𝗿𝗶𝘁𝘂𝗮𝗹 𝗠𝗮𝘀𝘁𝗲𝗿𝗰𝗹𝗮𝘀𝘀 𝘆𝗲𝘀𝘁𝗲𝗿𝗱𝗮𝘆! \n\nThe top 1% of leaders who embrace spiritually conscious leadership know that it's the key to boosting team motivation, productivity, and profitability—all in a supportive and loving environment. \n\nIn our 𝗡𝗘𝗪 𝗩𝗶𝘀𝗶𝗼𝗻𝗮𝗿𝘆 𝗟𝗲𝗮𝗱𝗲𝗿𝘀𝗵𝗶𝗽 𝗠𝗮𝘀𝘁𝗲𝗿𝗰𝗹𝗮𝘀𝘀, we're making spiritual growth a priority for you, your team, and those you serve.\n\n𝗬𝗲𝘀𝘁𝗲𝗿𝗱𝗮𝘆, 𝘄𝗲 𝗲𝘅𝗽𝗹𝗼𝗿𝗲𝗱:\n𝗧𝗼𝗽𝗶𝗰: Unveiling Your True Essence: A Journey to Authentic Self-Discovery\n-Build greater confidence and self-worth\n-Strengthen your relationship with yourself\n-Increase your sense of calm and resilience\n\n𝗝𝗼𝗶𝗻 𝘂𝘀 𝗳𝗼𝗿 𝗗𝗮𝘆 𝟮 𝗼𝗳 𝘁𝗵𝗲 𝗠𝗮𝘀𝘁𝗲𝗿𝗰𝗹𝗮𝘀𝘀 𝘁𝗼𝗱𝗮𝘆 𝗮𝘁 𝟰 𝗣𝗠 𝗨𝗞 𝘁𝗶𝗺𝗲.\n\n𝗦𝗶𝗴𝗻 𝘂𝗽 𝗵𝗲𝗿𝗲: https://lnkd.in/errS7BxA\n\n𝗝𝗼𝗶𝗻 𝘃𝗶𝗮 𝗭𝗼𝗼𝗺 𝗮𝘁 𝟰 𝗣𝗠 𝘁𝗼𝗱𝗮𝘆 𝘁𝗶𝗹𝗹 𝗙𝗿𝗶𝗱𝗮𝘆: https://lnkd.in/ejAxpVpH\n\nIf you'd like the details, come and join us! Or if you'd a like a replay, send me a message or DM me so I can send you the link!\n\nSee you later!\n\nGina xx",
			"attachments": [
				{
					"id": "D4E10AQGgcbcW0l0bcA",
					"sticker": false,
					"size": {
						"height": 353,
						"width": 561
					},
					"unavailable": false,
					"type": "img",
					"url": "https://media.licdn.com/dms/image/v2/D4E10AQGgcbcW0l0bcA/image-shrink_1280/image-shrink_1280/0/1725368894648?e=1725984000&v=beta&t=d_t-StNDDCLMV5alKxSosIK7gviX2TMll3SkFVYebAg"
				}
			],
			"author": {
				"public_identifier": "ginagardinerassociates",
				"name": "GINA GARDINER RADICAL CHANGE CATALYST AND LEADERSHIP ADVISOR",
				"is_company": false,
				"headline": "Radical Change Catalyst & Leadership Speaker, Consultant, Coach & Mentor Igniting Leadership Potential for Lasting, Holistic & Profitable Success #success #leadership #personaldevelopment #mediatraining"
			},
			"is_repost": false,
			"id": "7236721657753600002"
		},
		{
			"type": "POST",
			"provider": "LINKEDIN",
			"social_id": "urn:li:activity:7236447875625295872",
			"share_url": "https://www.linkedin.com/posts/nickunsworth1_september-lifeonfire-goals-activity-7236447875625295872-5mRl?utm_source=combined_share_message&utm_medium=member_desktop",
			"date": "20h",
			"parsed_datetime": "2024-09-02T19:02:20.214Z",
			"comment_counter": 0,
			"impressions_counter": 0,
			"reaction_counter": 0,
			"repost_counter": 0,
			"permissions": {
				"can_post_comments": true,
				"can_react": true,
				"can_share": true
			},
			"text": "What are your #September goals?\n\n\nBy setting clear, SMART goals for this new month, you're giving your life direction and boosting your productivity and personal growth. It's like creating your own personal roadmap, making the journey towards your bigger dreams and aspirations manageable and exciting.\n\nRemember, the key is to choose goals that resonate with you and align with your long-term vision. Let us know what you're planning to crush in the comments!\n\n#lifeonfire #goals #monthlygoals #septembergoals",
			"attachments": [
				{
					"id": "D5622AQEQ3K2BxUMF6w",
					"sticker": false,
					"size": {
						"height": 1080,
						"width": 1080
					},
					"unavailable": false,
					"type": "img",
					"url": "https://media.licdn.com/dms/image/v2/D5622AQEQ3K2BxUMF6w/feedshare-shrink_2048_1536/feedshare-shrink_2048_1536/0/1725303619317?e=1728518400&v=beta&t=SvlyIaHjujv_QRq95CnhqZOAdFwb-hC9HL3w9ykVWfU"
				}
			],
			"author": {
				"public_identifier": "nickunsworth1",
				"name": "Nick Unsworth",
				"is_company": false,
				"headline": "High Performance Coach, International Speaker, & Best-Selling Author"
			},
			"is_repost": false,
			"id": "7236447875625295872"
		},
		{
			"type": "POST",
			"provider": "LINKEDIN",
			"social_id": "urn:li:activity:7236064374086340610",
			"share_url": "https://www.linkedin.com/posts/cpududetech_windows11-startmenu-productivity-activity-7236064374086340610-Kvdd?utm_source=combined_share_message&utm_medium=member_desktop",
			"date": "1d",
			"parsed_datetime": "2024-09-02T15:02:20.214Z",
			"comment_counter": 0,
			"impressions_counter": 0,
			"reaction_counter": 0,
			"repost_counter": 0,
			"permissions": {
				"can_post_comments": true,
				"can_react": true,
				"can_share": true
			},
			"text": "Have you upgraded your business to Windows 11 yet? If not, now might be the perfect time to consider it - especially with the exciting new changes coming to the Start menu. Microsoft has been experimenting with different layouts, and the latest updates make navigating your apps even easier.\n\nWindows 11 is introducing a new \"Category\" view in the Start menu's All apps section. This design organizes your apps into neat categories, making it simpler to find what you need without endless scrolling. Imagine quickly locating your tools with just a glance, saving you time and boosting productivity.\n\nPlus, the new Grid layout is smart - it groups apps by their first letter making it easier to find them.\n\nUpgrading to Windows 11 isn't just about a fresh look; it's about enhancing your workflow. With these new Start menu features on the way, there's never been a better time to make the switch. Ready to take the leap? Let my team help - get in touch. #Windows11 #StartMenu #Productivity\r\n\r\nhttps://lnkd.in/en9UQBYx",
			"attachments": [
				{
					"id": "D4E10AQF6RFlDfLbLRw",
					"sticker": false,
					"size": {
						"height": 720,
						"width": 1280
					},
					"unavailable": false,
					"type": "img",
					"url": "https://media.licdn.com/dms/image/v2/D4E10AQF6RFlDfLbLRw/image-shrink_1280/image-shrink_1280/0/1725212184855?e=1725984000&v=beta&t=Mh7XnaTBcGnK_zcEVV7yCtUL3pSKlntc_nCLbEL5n8k"
				}
			],
			"author": {
				"public_identifier": "cpududetech",
				"name": "Ben Emond",
				"is_company": false,
				"headline": "Computer Services Professional helping small businesses and sole proprietors have a worry free computing experience."
			},
			"is_repost": false,
			"id": "7236064374086340610"
		}
	],
	"config": {
		"params": {
			"api": "classic",
			"category": "posts",
			"keywords": "boosting productivity",
			"sort_by": "date",
			"date_posted": "past_week",
			"content_type": "images",
			"author": {
				"keywords": "CEO"
			}
		}
	},
	"paging": {
		"start": 0,
		"page_count": 10,
		"total_count": 6
	},
	"cursor": "eyJhY2NvdW50X2lkIjoiOXE3bDFVZExUZGkwcEFod2xPUEVNdyIsImxpbWl0IjoxMCwic3RhcnQiOjEwLCJwYXJhbXMiOnsiYXBpIjoiY2xhc3NpYyIsImNhdGVnb3J5IjoicG9zdHMiLCJrZXl3b3JkcyI6ImJvb3N0aW5nIHByb2R1Y3Rpdml0eSIsInNvcnRfYnkiOiJkYXRlIiwiZGF0ZV9wb3N0ZWQiOiJwYXN0X3dlZWsiLCJjb250ZW50X3R5cGUiOiJpbWFnZXMiLCJhdXRob3IiOnsia2V5d29yZHMiOiJDRU8ifX19"
}
```