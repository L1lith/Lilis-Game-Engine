import "@/styles/Header.scss"

export default function Header({base}) {
    return (<header class="site-header">
		<a href="/"><img height="500" width="475" class="site-logo" src="lilis-game-engine-logo.png" alt="Lili's Game Engine"/></a>
        <nav class="site-nav">
            <ul>
                <li>
                    <a href={base + 'demos'}>Demo Games</a>
                </li>
                <li>
                    <a href={base + 'docs'}>Documentation</a>
                </li>
                <li>
                    <a href="https://webslc.com">About Lili</a>
                </li>
            </ul>
        </nav>
	</header>)
} // 