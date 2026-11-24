# MNC Creative Suite for GitHub Pages

This browser build uses Creative Suite v0.9.13.2. It opens with demo artwork and a sample card. The landing page links to [MNCDB](https://flarnrules.github.io/mnc-db/).

## Publish from your GitHub account

1. Extract this archive. Use the `mnc-creative-suite/` folder as the root of a new repository named `mnc-creative-suite`. Keep the included `.nojekyll` file in that root.
2. Push the files to `main`. GitHub Pro supports Pages from a private personal repository. GitHub Free supports Pages from a public repository. The published website on a personal account is public in either case. [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) · [Publishing and visibility](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
3. In that repository, open **Settings → Pages**. Choose **Deploy from a branch**, then **main** and **/(root)**. Save and wait for the deployment. Use the page link shown in that setting.
4. Open the link in a private browser window. Try **Open Creative Suite**, then send the link to your friend.

### Push from WSL with GitHub CLI

For a **new private repo** on a Pages-eligible account, run this from the extracted folder after authenticating `gh` in WSL.

```bash
git init -b main
git add .
git commit -m "Publish MNC Creative Suite browser edition"
gh repo create flarnrules/mnc-creative-suite --private --source=. --remote=origin --push
```

For a GitHub Free public demo, choose `--public` in the last command. It makes the demo repository and its included files visible. Keep personal workbooks, artwork, and project backups in your separate private workspace.

If you use the suggested repository name, the Pages address is [flarnrules.github.io/mnc-creative-suite/](https://flarnrules.github.io/mnc-creative-suite/) after publishing.

## Link an existing Item

In **Card Designer**, set **Role / family** to **Item**. Choose **Meme items** (or the appropriate group) under **Item set group**, then click **Open set slots**. Choose the card in **Linked design** on the row you want.

In an existing Pages checkout, copy the contents of this folder into the repository root, commit them, and push to the branch you use for Pages.

## Send a card back

1. Open **Artwork** and import your image. Choose **Use on card** to use it on the sample or **New card** to start another.
2. Edit the card. The browser stores your changes locally.
3. Choose **Project & Backup → Export project JSON** and send that file for further editing. Import the JSON into a separate review project so it can be opened alongside your main collection.

## Run a local preview

From this folder, run `python3 -m http.server 8000 --bind 127.0.0.1` and open [localhost:8000](http://localhost:8000/).
